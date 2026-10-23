import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { cpfValido, emailValido, somenteDigitos } from '$lib/cpf.js';
import { gerarSenhaTemporaria, hashSenha } from '$lib/server/auth.js';
import { TIPOS_PROCURACAO, arquivoParaBase64, gerarQrToken } from '$lib/server/agendamento.js';
import { agendaPublica, conferirVaga, dataHoraDoSlot } from '$lib/server/agenda.js';
import { SLUG_ENTREGA_CHAVES, buscarMurano } from '$lib/server/entregaChaves.js';
import { notificarFuncionarios } from '$lib/server/notificacao.js';
import { registrarLog } from '$lib/server/log.js';
import { formatarCpf } from '$lib/cpf.js';
import { unidadeAgendavel } from '$lib/unidadeAgendavel.js';

// Rota pública (sem login): agendamento de entrega de chaves do Murano.

async function carregarUnidades(empreendimentoId, tipoEventoId) {
  const unidades = await db.unidade.findMany({
    where: { empreendimentoId },
    select: {
      id: true,
      bloco: true,
      numero: true,
      compradores: true,
      vistoriaStatus: true,
      agendamentos: {
        where: { tipoEventoId, status: { not: 'cancelado' } },
        select: { id: true },
        take: 1
      }
    }
  });
  return unidades
    // unidade já agendada não aparece mais na lista (não dá pra agendar a mesma unidade duas vezes)
    .filter((u) => u.agendamentos.length === 0)
    // estoque, jurídico, em notificação ou sem comprador na base: nada a entregar, não aparece
    .filter(unidadeAgendavel)
    .map((u) => ({ id: u.id, bloco: u.bloco, numero: u.numero }))
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

  return {
    disponivel: Boolean(murano && tipoEvento),
    unidades: murano && tipoEvento ? await carregarUnidades(murano.id, tipoEvento.id) : [],
    // dias abertos e horários com vaga, definidos pela equipe em /admin/agenda
    agenda: await agendaPublica()
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
      proprietarioNome: String(form.get('proprietarioNome') ?? '').trim(),
      unidadeId: String(form.get('unidadeId') ?? ''),
      data: String(form.get('data') ?? ''),
      horario: String(form.get('horario') ?? '')
    };
    const erro = (msg) => fail(400, { erro: msg, valores });

    if (valores.nome.length < 3) return erro('Informe o nome do investidor.');
    if (!cpfValido(valores.cpf)) return erro('CPF inválido.');
    if (somenteDigitos(valores.telefone).length < 10) return erro('Informe um telefone válido com DDD.');
    if (!emailValido(valores.email)) return erro('Informe um e-mail válido.');
    if (!['sim', 'nao'].includes(valores.ehProprietario)) {
      return erro('Informe se você é o proprietário da unidade.');
    }
    const ehProprietario = valores.ehProprietario === 'sim';

    // quem não é o proprietário precisa anexar a procuração já no agendamento — a equipe confere no dossiê da unidade
    let procuracaoBase64 = null;
    let documentoIdentidadeBase64 = null;
    if (!ehProprietario) {
      if (valores.proprietarioNome.length < 3) return erro('Informe o nome do proprietário da unidade.');
      try {
        procuracaoBase64 = await arquivoParaBase64(form.get('procuracao'), {
          tipos: TIPOS_PROCURACAO,
          mensagemTipo: 'A procuração precisa ser um documento: PDF, DOC ou DOCX (não aceitamos imagem).'
        });
      } catch (err) {
        return erro(err.message);
      }
      if (!procuracaoBase64) return erro('Anexe a procuração para confirmar o agendamento.');
      // além da procuração, o documento de identidade de quem vai assinar/comparecer (foto ou PDF)
      try {
        documentoIdentidadeBase64 = await arquivoParaBase64(form.get('identidade'));
      } catch (err) {
        return erro(`Documento de identidade: ${err.message}`);
      }
      if (!documentoIdentidadeBase64) return erro('Anexe o documento de identidade de quem vai assinar/comparecer.');
    }

    const [murano, tipoEvento] = await Promise.all([
      buscarMurano(),
      db.tipoEvento.findUnique({ where: { slug: SLUG_ENTREGA_CHAVES } })
    ]);
    if (!murano || !tipoEvento) return erro('Agendamento indisponível no momento.');

    const unidade = await db.unidade.findFirst({
      where: { id: valores.unidadeId, empreendimentoId: murano.id }
    });
    if (!unidade || !unidadeAgendavel(unidade)) return erro('Escolha uma unidade da lista.');

    // revalida no envio — outra pessoa pode ter agendado a unidade enquanto o formulário estava aberto
    const jaAgendada = await db.agendamento.findFirst({
      where: { unidadeId: unidade.id, tipoEventoId: tipoEvento.id, status: { not: 'cancelado' } }
    });
    if (jaAgendada) return erro('Esta unidade já tem entrega de chaves agendada. Escolha outra.');

    const dataHora = dataHoraDoSlot(valores.data, valores.horario);
    const vaga = await conferirVaga(db, valores.data, valores.horario);
    if (!vaga.ok) return erro(vaga.motivo);

    // Investidor mínimo só pra satisfazer a relação obrigatória. Se o CPF já existe, reaproveita
    // sem alterar nada. Senha aleatória descartada: esse registro não acessa o app.
    const cpf = somenteDigitos(valores.cpf);
    const investidor =
      (await db.investidor.findUnique({ where: { cpf } })) ??
      (await db.investidor.create({
        data: { nome: valores.nome, cpf, senhaHash: hashSenha(gerarSenhaTemporaria()), primeiroAcesso: true }
      }));

    // a vaga do horário e a unidade são conferidas de novo DENTRO da transação (serializável): duas
    // pessoas enviando ao mesmo tempo não conseguem estourar o limite nem agendar a mesma unidade
    let agendamento;
    try {
      agendamento = await db.$transaction(
        async (tx) => {
          const v = await conferirVaga(tx, valores.data, valores.horario);
          if (!v.ok) throw new Error(v.motivo);
          const ja = await tx.agendamento.findFirst({
            where: { unidadeId: unidade.id, tipoEventoId: tipoEvento.id, status: { not: 'cancelado' } }
          });
          if (ja) throw new Error('Esta unidade já tem entrega de chaves agendada. Escolha outra.');
          return tx.agendamento.create({
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
              proprietarioNome: ehProprietario ? null : valores.proprietarioNome,
              procuracaoBase64,
              documentoBase64: documentoIdentidadeBase64,
              procuracaoCpf: procuracaoBase64 ? cpf : null
            }
          });
        },
        { isolationLevel: 'Serializable' }
      );
    } catch (err) {
      if (err?.code === 'P2034') return erro('Muitas pessoas agendando ao mesmo tempo. Tente novamente.');
      return erro(err?.message ?? 'Não foi possível agendar.');
    }

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
        descricao: `Entrega de chaves agendada para ${valores.data} às ${valores.horario} (${valores.nome})${procuracaoBase64 ? ` — procuração e documento de identidade anexados, proprietário: ${valores.proprietarioNome}` : ''}`
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
