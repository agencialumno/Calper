import { error, fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { gerarPdfBase64, montarVariaveis, obterTemplate, preencher } from '$lib/server/documentos.js';
import { criarEnvelopeEmbedded } from '$lib/server/docusign.js';
import { SLUG_ENTREGA_CHAVES } from '$lib/server/entregaChaves.js';
import { registrarLog, rotuloFuncionario } from '$lib/server/log.js';
import { TIPO_CHECKLIST, TIPO_TERMO, montarChecklist, parseChecklist } from '$lib/documentosPadrao.js';

const NOME_DOCUMENTO = { termo: 'Termo de Entrega de Chaves', checklist: 'Checklist - Entrega de Chaves' };
const TIPO_TEMPLATE = { termo: TIPO_TERMO, checklist: TIPO_CHECKLIST };

async function buscarAgendamento(id) {
  const agendamento = await db.agendamento.findUnique({
    where: { id },
    include: {
      tipoEvento: true,
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

/** Quem assina: titular escolhido no passo 2 ou o procurador informado no agendamento. */
function resolverSignatario(agendamento, quem) {
  const vinculo = agendamento.unidade.investidores.find((v) => v.investidorId === quem);
  const nome = vinculo ? vinculo.investidor.nome : agendamento.nomeCompareceu;
  const email = agendamento.emailCompareceu ?? vinculo?.email;
  return { nome, email };
}

// as variáveis fixas do empreendimento ficam guardadas no template do termo
async function textoPreenchido(agendamento, tipo) {
  const empreendimentoId = agendamento.unidade.empreendimentoId;
  const [template, termo] = await Promise.all([
    obterTemplate(empreendimentoId, TIPO_TEMPLATE[tipo]),
    obterTemplate(empreendimentoId, TIPO_TERMO)
  ]);
  const variaveis = montarVariaveis({
    unidade: agendamento.unidade,
    proprietarios: agendamento.unidade.investidores.map((v) => v.investidor.nome),
    variaveisTemplate: termo.variaveis ?? {}
  });
  return preencher(template.conteudo, variaveis);
}

export async function load({ params, url }) {
  const agendamento = await buscarAgendamento(params.id);
  const u = agendamento.unidade;
  const passo = Math.min(5, Math.max(1, Number(url.searchParams.get('passo')) || 1));
  const quemParam = url.searchParams.get('quem');
  const quem = quemParam ?? (agendamento.ehProprietario === false ? 'procurador' : '');

  const documentos = Object.fromEntries(
    ['termo', 'checklist'].map((tipo) => [
      tipo,
      agendamento.documentosAssinados.find((d) => d.tipo === tipo)?.status ?? null
    ])
  );

  const base = {
    passo,
    quem,
    aviso: url.searchParams.get('aviso'),
    documentos,
    agendamento: {
      id: agendamento.id,
      dataHora: agendamento.dataHora,
      nome: agendamento.nomeCompareceu,
      cpf: agendamento.cpfCompareceu,
      email: agendamento.emailCompareceu,
      ehProprietario: agendamento.ehProprietario,
      temProcuracao: Boolean(agendamento.procuracaoBase64),
      procuracaoTipo: agendamento.procuracaoBase64
        ? agendamento.procuracaoBase64.slice(5, agendamento.procuracaoBase64.indexOf(';'))
        : null
    },
    unidade: {
      id: u.id,
      bloco: u.bloco,
      numero: u.numero,
      quartos: u.quartos,
      statusPagamento: u.statusPagamento,
      vistoriaAprovada: u.vistoriaAprovada,
      escrituraRegistrada: u.escrituraRegistrada
    },
    titulares: u.investidores.map((v) => ({
      investidorId: v.investidorId,
      nome: v.investidor.nome,
      cpf: v.investidor.cpf
    })),
    signatario: resolverSignatario(agendamento, quem)
  };

  if (passo === 3 && documentos.termo !== 'assinado') {
    return { ...base, texto: await textoPreenchido(agendamento, 'termo') };
  }
  if (passo === 4 && documentos.checklist !== 'assinado') {
    return { ...base, checklist: parseChecklist(await textoPreenchido(agendamento, 'checklist')) };
  }
  return base;
}

export const actions = {
  enviar: async (event) => {
    const { request, params, url, locals } = event;
    const agendamento = await buscarAgendamento(params.id);
    const form = await request.formData();
    const tipo = String(form.get('tipo') ?? '');
    const quem = String(form.get('quem') ?? '');
    if (!['termo', 'checklist'].includes(tipo)) return fail(400, { erro: 'Documento inválido.' });

    const existente = await db.documentoAssinado.findUnique({
      where: { agendamentoId_tipo: { agendamentoId: agendamento.id, tipo } }
    });
    if (existente?.status === 'assinado') return fail(400, { erro: 'Este documento já foi assinado.' });

    const signatario = resolverSignatario(agendamento, quem);
    if (!signatario.nome || !signatario.email) {
      return fail(400, { erro: 'Quem retira as chaves precisa ter nome e e-mail. Volte ao passo 2.' });
    }

    let texto;
    if (tipo === 'termo') {
      texto = String(form.get('texto') ?? '').trim();
    } else {
      const numeros = form.getAll('numero').map(String);
      const descricoes = form.getAll('descricao').map(String);
      const temQtdes = form.getAll('temQtde').map(String);
      const qtdes = form.getAll('qtde').map((q) => String(q).trim());
      const itens = numeros.map((numero, i) => ({
        numero,
        descricao: descricoes[i] ?? '',
        temQtde: temQtdes[i] === '1',
        qtde: qtdes[i] ?? '',
        recebido: form.get(`recebido_${numero}`) === 'sim'
      }));
      texto = montarChecklist({
        cabecalho: String(form.get('cabecalho') ?? ''),
        itens,
        rodape: String(form.get('rodape') ?? '')
      });
    }

    if (!texto) return fail(400, { erro: 'O documento está vazio.' });
    const pendente = texto.match(/\{\{\s*\w+\s*\}\}/g);
    if (pendente) {
      return fail(400, { erro: `Preencha antes de enviar: ${[...new Set(pendente)].join(', ')}` });
    }

    let envelopeId;
    let urlAssinatura;
    try {
      const pdfBase64 = await gerarPdfBase64(texto, NOME_DOCUMENTO[tipo]);
      ({ envelopeId, urlAssinatura } = await criarEnvelopeEmbedded({
        pdfBase64,
        nomeDocumento: NOME_DOCUMENTO[tipo],
        signatario: { ...signatario, clientUserId: agendamento.id },
        retornoUrl: `${url.origin}/admin/entrega-chaves/${agendamento.id}/assinatura-concluida?tipo=${tipo}&quem=${encodeURIComponent(quem)}`
      }));
    } catch (err) {
      console.error('DocuSign:', err?.response?.body ?? err);
      return fail(502, { erro: 'Não foi possível enviar para assinatura (DocuSign). Veja o log do servidor.' });
    }

    await db.documentoAssinado.upsert({
      where: { agendamentoId_tipo: { agendamentoId: agendamento.id, tipo } },
      update: { docusignEnvelopeId: envelopeId, status: 'pendente' },
      create: { agendamentoId: agendamento.id, tipo, docusignEnvelopeId: envelopeId }
    });

    const u = agendamento.unidade;
    await registrarLog({
      event,
      atorTipo: 'funcionario',
      acao: tipo === 'termo' ? 'termo_enviado_assinatura' : 'checklist_enviado_assinatura',
      descricao: `${rotuloFuncionario(locals.funcionario)} enviou ${NOME_DOCUMENTO[tipo]} da Unidade ${u.numero}, Bloco ${u.bloco} para assinatura — retirada das chaves por ${signatario.nome} (${signatario.email})`,
      entidadeTipo: 'DocumentoAssinado',
      entidadeId: envelopeId
    });

    throw redirect(303, urlAssinatura);
  }
};
