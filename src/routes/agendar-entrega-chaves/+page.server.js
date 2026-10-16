import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { cpfValido, emailValido, somenteDigitos } from '$lib/cpf.js';
import { gerarSenhaTemporaria, hashSenha } from '$lib/server/auth.js';
import {
  HORARIOS_DISPONIVEIS,
  arquivoParaBase64,
  faixaDeDatasPermitida,
  gerarQrToken
} from '$lib/server/agendamento.js';
import { SLUG_ENTREGA_CHAVES, buscarMurano } from '$lib/server/entregaChaves.js';
import { notificarFuncionarios } from '$lib/server/notificacao.js';
import { registrarLog } from '$lib/server/log.js';
import { formatarCpf } from '$lib/cpf.js';

// Rota pública (sem login): agendamento de entrega de chaves do Murano.

async function carregarUnidades(empreendimentoId, tipoEventoId) {
  const unidades = await db.unidade.findMany({
    where: { empreendimentoId },
    select: {
      id: true,
      bloco: true,
      numero: true,
      agendamentos: {
        where: { tipoEventoId, status: { not: 'cancelado' } },
        select: { id: true },
        take: 1
      }
    }
  });
  return unidades
    .map((u) => ({ id: u.id, bloco: u.bloco, numero: u.numero, agendada: u.agendamentos.length > 0 }))
    .sort(
      (a, b) =>
        a.bloco.localeCompare(b.bloco, 'pt-BR', { numeric: true }) ||
        a.numero.localeCompare(b.numero, 'pt-BR', { numeric: true })
    );
}

export async function load() {
  const [murano, tipoEvento] = await Promise.all([
    buscarMurano(),
    db.tipoEvento.findUnique({ where: { slug: SLUG_ENTREGA_CHAVES } })
  ]);
  const { minimo, maximo } = faixaDeDatasPermitida();

  return {
    disponivel: Boolean(murano && tipoEvento),
    unidades: murano && tipoEvento ? await carregarUnidades(murano.id, tipoEvento.id) : [],
    horarios: HORARIOS_DISPONIVEIS,
    dataMinima: minimo.toISOString().slice(0, 10),
    dataMaxima: maximo.toISOString().slice(0, 10)
  };
}

export const actions = {
  default: async (event) => {
    const { request } = event;
    const form = await request.formData();
    const valores = {
      nome: String(form.get('nome') ?? '').trim(),
      cpf: String(form.get('cpf') ?? ''),
      telefone: String(form.get('telefone') ?? '').trim(),
      email: String(form.get('email') ?? '').trim(),
      ehProprietario: String(form.get('ehProprietario') ?? ''),
      unidadeId: String(form.get('unidadeId') ?? ''),
      data: String(form.get('data') ?? ''),
      horario: String(form.get('horario') ?? '')
    };
    const erro = (msg) => fail(400, { erro: msg, valores });

    if (valores.nome.length < 3) return erro('Informe o nome completo.');
    if (!cpfValido(valores.cpf)) return erro('CPF inválido.');
    if (somenteDigitos(valores.telefone).length < 10) return erro('Informe um telefone válido com DDD.');
    if (!emailValido(valores.email)) return erro('Informe um e-mail válido.');
    if (!['sim', 'nao'].includes(valores.ehProprietario)) {
      return erro('Informe se você é o proprietário da unidade.');
    }
    const ehProprietario = valores.ehProprietario === 'sim';

    // quem não é o proprietário precisa anexar a procuração já no agendamento — a equipe confere no dossiê da unidade
    let procuracaoBase64 = null;
    if (!ehProprietario) {
      try {
        procuracaoBase64 = await arquivoParaBase64(form.get('procuracao'));
      } catch (err) {
        return erro(err.message);
      }
      if (!procuracaoBase64) return erro('Anexe a procuração para confirmar o agendamento.');
    }

    const [murano, tipoEvento] = await Promise.all([
      buscarMurano(),
      db.tipoEvento.findUnique({ where: { slug: SLUG_ENTREGA_CHAVES } })
    ]);
    if (!murano || !tipoEvento) return erro('Agendamento indisponível no momento.');

    const unidade = await db.unidade.findFirst({
      where: { id: valores.unidadeId, empreendimentoId: murano.id }
    });
    if (!unidade) return erro('Escolha uma unidade da lista.');

    // revalida no envio — outra pessoa pode ter agendado a unidade enquanto o formulário estava aberto
    const jaAgendada = await db.agendamento.findFirst({
      where: { unidadeId: unidade.id, tipoEventoId: tipoEvento.id, status: { not: 'cancelado' } }
    });
    if (jaAgendada) return erro('Esta unidade já tem entrega de chaves agendada. Escolha outra.');

    const { minimo, maximo } = faixaDeDatasPermitida();
    const dataEscolhida = new Date(`${valores.data}T00:00:00`);
    if (
      !valores.data ||
      Number.isNaN(dataEscolhida.getTime()) ||
      dataEscolhida < minimo ||
      dataEscolhida > maximo
    ) {
      return erro('Escolha uma data válida dentro da janela disponível.');
    }
    if (!HORARIOS_DISPONIVEIS.includes(valores.horario)) return erro('Escolha um horário válido.');

    const [hora, minuto] = valores.horario.split(':').map(Number);
    const dataHora = new Date(dataEscolhida);
    dataHora.setHours(hora, minuto, 0, 0);

    // Investidor mínimo só pra satisfazer a relação obrigatória. Se o CPF já existe, reaproveita
    // sem alterar nada. Senha aleatória descartada: esse registro não acessa o app.
    const cpf = somenteDigitos(valores.cpf);
    const investidor =
      (await db.investidor.findUnique({ where: { cpf } })) ??
      (await db.investidor.create({
        data: { nome: valores.nome, cpf, senhaHash: hashSenha(gerarSenhaTemporaria()), primeiroAcesso: true }
      }));

    const agendamento = await db.agendamento.create({
      data: {
        unidadeId: unidade.id,
        tipoEventoId: tipoEvento.id,
        investidorId: investidor.id,
        dataHora,
        status: 'confirmado',
        qrToken: gerarQrToken(),
        nomeCompareceu: valores.nome,
        cpfCompareceu: cpf,
        telefoneCompareceu: valores.telefone,
        emailCompareceu: valores.email,
        ehProprietario,
        procuracaoBase64,
        procuracaoCpf: procuracaoBase64 ? cpf : null
      }
    });

    if (procuracaoBase64) {
      await db.procuracaoUnidade.create({
        data: {
          unidadeId: unidade.id,
          agendamentoId: agendamento.id,
          nome: valores.nome,
          cpf,
          origem: 'agendamento',
          arquivoBase64: procuracaoBase64
        }
      });
    }

    await db.historicoUnidade.create({
      data: {
        unidadeId: unidade.id,
        tipo: 'outro',
        descricao: `Entrega de chaves agendada para ${valores.data} às ${valores.horario} (${valores.nome})${procuracaoBase64 ? ' — procuração anexada' : ''}`
      }
    });
    await registrarLog({
      event,
      atorTipo: 'investidor',
      investidorId: investidor.id,
      acao: 'agendamento_criado',
      descricao: `${valores.nome} (CPF ${formatarCpf(cpf)}) agendou entrega de chaves pelo formulário público para ${valores.data} às ${valores.horario} — Unidade ${unidade.numero}, Bloco ${unidade.bloco}`,
      entidadeTipo: 'Agendamento',
      entidadeId: agendamento.id
    });
    await notificarFuncionarios({
      titulo: 'Nova entrega de chaves agendada',
      mensagem: `${valores.nome} agendou para ${valores.data} às ${valores.horario} (Unidade ${unidade.numero} — Bloco ${unidade.bloco}).`,
      link: '/admin/entrega-chaves'
    });

    return {
      sucesso: true,
      resumo: {
        nome: valores.nome,
        unidade: `Bloco ${unidade.bloco} - nº ${unidade.numero}`,
        data: valores.data,
        horario: valores.horario,
        id: agendamento.id
      }
    };
  }
};
