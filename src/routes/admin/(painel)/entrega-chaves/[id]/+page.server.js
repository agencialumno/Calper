import { error, fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { arquivoParaBase64 } from '$lib/server/agendamento.js';
import { montarDocumento, quartosDaUnidade, titularesDaUnidade } from '$lib/server/documentos.js';
import {
  ROTULO_VINCULO,
  SLUG_ENTREGA_CHAVES,
  enviarDocumentoParaAssinatura,
  retiranteDoAgendamento
} from '$lib/server/entregaChaves.js';
import { registrarLog, rotuloFuncionario } from '$lib/server/log.js';
import { cpfValido, emailValido, somenteDigitos } from '$lib/cpf.js';
import { montarChecklist, parseChecklist } from '$lib/documentosPadrao.js';

async function buscarAgendamento(id) {
  const agendamento = await db.agendamento.findUnique({
    where: { id },
    include: {
      tipoEvento: true,
      presencas: { orderBy: { createdAt: 'asc' } },
      documentosAssinados: { select: { tipo: true, status: true, assinadoEm: true } },
      unidade: {
        include: { empreendimento: true, investidores: { include: { investidor: true } } }
      }
    }
  });
  if (!agendamento || agendamento.tipoEvento.slug !== SLUG_ENTREGA_CHAVES) {
    throw error(404, 'Agendamento de entrega de chaves não encontrado');
  }
  return agendamento;
}

const irPara = (id, passo) => `/admin/entrega-chaves/${id}?passo=${passo}`;

export async function load({ params, url }) {
  const agendamento = await buscarAgendamento(params.id);
  const u = agendamento.unidade;
  const passo = Math.min(5, Math.max(1, Number(url.searchParams.get('passo')) || 1));

  const retirante = retiranteDoAgendamento(agendamento);
  // termo e checklist só depois de confirmar quem retira (e, sendo procurador, com procuração)
  const procuradorSemProcuracao = retirante?.vinculo === 'procurador' && !agendamento.procuracaoBase64;
  if ((passo === 3 || passo === 4) && (!retirante || procuradorSemProcuracao)) {
    throw redirect(303, irPara(agendamento.id, 2));
  }

  const documentos = Object.fromEntries(
    ['termo', 'checklist'].map((tipo) => [
      tipo,
      agendamento.documentosAssinados.find((d) => d.tipo === tipo)?.status ?? null
    ])
  );

  const base = {
    passo,
    aviso: url.searchParams.get('aviso'),
    documentos,
    agendamento: {
      id: agendamento.id,
      status: agendamento.status,
      dataHora: agendamento.dataHora,
      // quem AGENDOU (campos originais, nunca alterados pelo fluxo do dia)
      nome: agendamento.nomeCompareceu,
      cpf: agendamento.cpfCompareceu,
      email: agendamento.emailCompareceu,
      ehProprietario: agendamento.ehProprietario,
      // quem RETIRA as chaves (confirmado no passo 2)
      retiranteNome: agendamento.retiranteNome,
      retiranteCpf: agendamento.retiranteCpf,
      retiranteEmail: agendamento.retiranteEmail,
      temProcuracao: Boolean(agendamento.procuracaoBase64),
      procuracaoTipo: agendamento.procuracaoBase64
        ? agendamento.procuracaoBase64.slice(5, agendamento.procuracaoBase64.indexOf(';'))
        : null
    },
    unidade: {
      id: u.id,
      bloco: u.bloco,
      numero: u.numero,
      quartos: quartosDaUnidade(u), // tipologia (base Murano) ou campo quartos
      statusQuitacao: u.statusQuitacao,
      vistoriaAprovada: u.vistoriaAprovada,
      escrituraRegistrada: u.escrituraRegistrada
    },
    titulares: titularesDaUnidade(u).map((t) => ({ id: t.id, nome: t.nome, cpf: t.cpf, principal: t.principal })),
    retirante: retirante ? { nome: retirante.nome, vinculo: retirante.vinculo } : null,
    presencas: agendamento.presencas.map((p) => ({
      id: p.id,
      nome: p.nome,
      vinculo: p.vinculo,
      vinculoRotulo: ROTULO_VINCULO[p.vinculo] ?? p.vinculo,
      createdAt: p.createdAt
    })),
    signatario: { nome: retirante?.nome ?? null, email: retirante?.email ?? null }
  };

  // quem retira (e seu vínculo) define como as partes aparecem no texto (procurador = representação)
  const opcoes = { retirante };

  if (passo === 3 && documentos.termo !== 'assinado') {
    return { ...base, texto: (await montarDocumento(u.id, 'termo', opcoes)).texto };
  }
  if (passo === 4 && documentos.checklist !== 'assinado') {
    const { texto } = await montarDocumento(u.id, 'checklist', opcoes);
    return { ...base, checklist: parseChecklist(texto) };
  }
  return base;
}

export const actions = {
  // Passo 2: confirma quem retira as chaves. Quem não é comprador da unidade precisa de procuração.
  confirmarRetirante: async (event) => {
    const { request, params, locals } = event;
    const agendamento = await buscarAgendamento(params.id);
    const form = await request.formData();

    const quem = String(form.get('quem') ?? '');
    const email = String(form.get('email') ?? '').trim();
    if (!emailValido(email)) {
      return fail(400, { erro: 'Informe um e-mail válido de quem retira as chaves — ele é usado na assinatura.' });
    }

    const titular = titularesDaUnidade(agendamento.unidade).find((t) => t.id === quem);
    let nome;
    let cpf = null;
    let vinculo;
    let procuracaoNova = null;

    if (titular) {
      nome = titular.nome;
      cpf = titular.cpf;
      vinculo = titular.principal ? 'comprador_principal' : 'comprador';
    } else if (quem === 'outro') {
      nome = String(form.get('nome') ?? '').trim();
      cpf = somenteDigitos(form.get('cpf'));
      if (nome.length < 3) return fail(400, { erro: 'Informe o nome completo de quem retira as chaves.' });
      if (!cpfValido(cpf)) return fail(400, { erro: 'Informe um CPF válido de quem retira as chaves.' });
      try {
        procuracaoNova = await arquivoParaBase64(form.get('procuracao'));
      } catch (err) {
        return fail(400, { erro: err.message });
      }
      if (!procuracaoNova && !agendamento.procuracaoBase64) {
        return fail(400, {
          erro: 'Quem retira não é comprador desta unidade: envie a procuração para continuar.'
        });
      }
      vinculo = 'procurador';
    } else {
      return fail(400, { erro: 'Escolha quem está retirando as chaves.' });
    }

    await db.$transaction([
      db.agendamento.update({
        where: { id: agendamento.id },
        // grava só os campos do retirante; os de quem agendou (nomeCompareceu etc.) ficam intactos
        data: {
          retiranteNome: nome,
          retiranteCpf: cpf,
          retiranteEmail: email,
          ...(procuracaoNova ? { procuracaoBase64: procuracaoNova } : {})
        }
      }),
      // só um retirante por entrega; acompanhantes registrados não são afetados
      db.presencaEntrega.deleteMany({
        where: { agendamentoId: agendamento.id, vinculo: { not: 'acompanhante' } }
      }),
      db.presencaEntrega.create({
        data: {
          agendamentoId: agendamento.id,
          unidadeId: agendamento.unidadeId,
          nome,
          vinculo,
          cpf,
          registradoPorId: locals.funcionario.id
        }
      })
    ]);

    const u = agendamento.unidade;
    const local = `Unidade ${u.numero}, Bloco ${u.bloco}`;
    if (procuracaoNova) {
      await registrarLog({
        event,
        atorTipo: 'funcionario',
        acao: 'documento_enviado',
        descricao: `${rotuloFuncionario(locals.funcionario)} anexou a procuração de ${nome} (CPF ${cpf}) — ${local}`,
        entidadeTipo: 'Agendamento',
        entidadeId: agendamento.id
      });
    }
    await registrarLog({
      event,
      atorTipo: 'funcionario',
      acao: 'retirante_confirmado',
      descricao: `${rotuloFuncionario(locals.funcionario)} registrou a presença de ${nome} (${ROTULO_VINCULO[vinculo]}) na entrega de chaves — ${local}. Agendamento feito por ${agendamento.nomeCompareceu ?? '—'}${agendamento.emailCompareceu ? ` (${agendamento.emailCompareceu})` : ''}`,
      entidadeTipo: 'Agendamento',
      entidadeId: agendamento.id
    });

    throw redirect(303, irPara(agendamento.id, 3));
  },

  // Lista de presença: outras pessoas que compareceram além de quem retira as chaves.
  adicionarPresente: async (event) => {
    const { request, params, locals } = event;
    const agendamento = await buscarAgendamento(params.id);
    const form = await request.formData();
    const nome = String(form.get('nome') ?? '').trim();
    if (nome.length < 3) return fail(400, { erro: 'Informe o nome de quem compareceu.' });

    await db.presencaEntrega.create({
      data: {
        agendamentoId: agendamento.id,
        unidadeId: agendamento.unidadeId,
        nome,
        vinculo: 'acompanhante',
        registradoPorId: locals.funcionario.id
      }
    });
    const u = agendamento.unidade;
    await registrarLog({
      event,
      atorTipo: 'funcionario',
      acao: 'presenca_registrada',
      descricao: `${rotuloFuncionario(locals.funcionario)} registrou a presença de ${nome} (${ROTULO_VINCULO.acompanhante}) — Unidade ${u.numero}, Bloco ${u.bloco}`,
      entidadeTipo: 'Agendamento',
      entidadeId: agendamento.id
    });
    return { sucesso: 'presenca' };
  },

  removerPresente: async (event) => {
    const { request, params, locals } = event;
    const form = await request.formData();
    const id = String(form.get('id') ?? '');
    const presenca = await db.presencaEntrega.findFirst({
      where: { id, agendamentoId: params.id, vinculo: 'acompanhante' },
      include: { unidade: true }
    });
    if (!presenca) return fail(404, { erro: 'Registro não encontrado.' });

    await db.presencaEntrega.delete({ where: { id } });
    await registrarLog({
      event,
      atorTipo: 'funcionario',
      acao: 'presenca_removida',
      descricao: `${rotuloFuncionario(locals.funcionario)} removeu ${presenca.nome} da lista de presença — Unidade ${presenca.unidade.numero}, Bloco ${presenca.unidade.bloco}`,
      entidadeTipo: 'Agendamento',
      entidadeId: params.id
    });
    return { sucesso: 'presenca' };
  },

  enviar: async (event) => {
    const { request, params } = event;
    const form = await request.formData();
    const tipo = String(form.get('tipo') ?? '');

    let texto;
    if (tipo === 'termo') {
      texto = String(form.get('texto') ?? '');
    } else if (tipo === 'checklist') {
      const numeros = form.getAll('numero').map(String);
      const descricoes = form.getAll('descricao').map(String);
      const temQtdes = form.getAll('temQtde').map(String);
      const qtdes = form.getAll('qtde').map((q) => String(q).trim());
      texto = montarChecklist({
        cabecalho: String(form.get('cabecalho') ?? ''),
        itens: numeros.map((numero, i) => ({
          numero,
          descricao: descricoes[i] ?? '',
          temQtde: temQtdes[i] === '1',
          qtde: qtdes[i] ?? '',
          recebido: form.get(`recebido_${numero}`) === 'sim'
        })),
        rodape: String(form.get('rodape') ?? '')
      });
    } else {
      return fail(400, { erro: 'Documento inválido.' });
    }

    // redireciona pro DocuSign em caso de sucesso; só volta aqui se algo impediu o envio
    const resultado = await enviarDocumentoParaAssinatura(event, {
      agendamentoId: params.id,
      tipo,
      texto,
      origem: 'fluxo'
    });
    return fail(400, { erro: resultado.erro });
  }
};
