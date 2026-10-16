import { db } from './db.js';

export const SLUG_ENTREGA_CHAVES = 'entrega-chaves';

/** Empreendimento Murano (busca por nome, sem diferenciar maiúsculas). */
export function buscarMurano() {
  return db.empreendimento.findFirst({
    where: { nome: { contains: 'Murano', mode: 'insensitive' } }
  });
}

// --- assinatura dos documentos (termo / checklist) ---

import { redirect } from '@sveltejs/kit';
import { criarEnvelopeEmbedded } from './docusign.js';
import { gerarPdfBase64 } from './documentos.js';
import { registrarLog, rotuloFuncionario } from './log.js';

export const NOME_DOCUMENTO = {
  termo: 'Termo de Entrega de Chaves',
  checklist: 'Checklist - Entrega de Chaves'
};

export const ROTA_UNIDADE = { termo: 'termo-entrega', checklist: 'checklist' };

export const ROTULO_VINCULO = {
  comprador_principal: 'Comprador principal',
  comprador: 'Comprador',
  procurador: 'Procurador',
  acompanhante: 'Acompanhante'
};

const VINCULOS_RETIRANTE = ['comprador_principal', 'comprador', 'procurador'];

/** Agendamento de entrega de chaves em aberto (não cancelado) da unidade, o mais recente. */
export function agendamentoAtivoDaUnidade(unidadeId) {
  return db.agendamento.findFirst({
    where: { unidadeId, tipoEvento: { slug: SLUG_ENTREGA_CHAVES }, status: { not: 'cancelado' } },
    orderBy: { createdAt: 'desc' },
    include: { presencas: true, documentosAssinados: { select: { tipo: true, status: true } } }
  });
}

/**
 * A procuração anexada vale pra quem está retirando? Vale quando há arquivo e ele foi enviado
 * pra essa mesma pessoa (mesmo CPF). Registros antigos sem CPF registrado valem pra quem foi confirmado.
 */
export function procuracaoValidaParaRetirante(agendamento, cpfRetirante) {
  if (!agendamento.procuracaoBase64) return false;
  if (!agendamento.procuracaoCpf) return true;
  return agendamento.procuracaoCpf === String(cpfRetirante ?? '').replace(/\D/g, '');
}

/** Quem retira as chaves já foi confirmado (passo 2)? Retorna a presença do retirante ou null. */
export function retiranteConfirmado(agendamento) {
  return agendamento.presencas?.find((p) => VINCULOS_RETIRANTE.includes(p.vinculo)) ?? null;
}

/**
 * Dados de quem retira as chaves (confirmados no dia), separados de quem agendou
 * (nomeCompareceu/emailCompareceu/cpfCompareceu, que não são alterados).
 */
export function retiranteDoAgendamento(agendamento) {
  const presenca = retiranteConfirmado(agendamento);
  if (!presenca) return null;
  return {
    nome: agendamento.retiranteNome ?? presenca.nome,
    email: agendamento.retiranteEmail,
    cpf: agendamento.retiranteCpf,
    vinculo: presenca.vinculo
  };
}

/**
 * Cria o envelope no DocuSign pro texto final e redireciona o atendente pra tela de assinatura.
 * Devolve { erro } quando algo impede o envio (nada é lançado nesse caso).
 * `origem`: 'fluxo' (passo a passo da entrega) ou 'unidade' (rotas /admin/unidades/[id]/...).
 */
export async function enviarDocumentoParaAssinatura(event, { agendamentoId, tipo, texto, origem }) {
  const { locals, url } = event;
  if (!NOME_DOCUMENTO[tipo]) return { erro: 'Documento inválido.' };

  const agendamento = await db.agendamento.findUnique({
    where: { id: agendamentoId },
    include: { unidade: true, presencas: true }
  });
  if (!agendamento) return { erro: 'Agendamento não encontrado.' };

  const existente = await db.documentoAssinado.findUnique({
    where: { agendamentoId_tipo: { agendamentoId, tipo } }
  });
  if (existente?.status === 'assinado') return { erro: 'Este documento já foi assinado.' };

  const retirante = retiranteDoAgendamento(agendamento);
  if (!retirante) return { erro: 'Confirme quem está retirando as chaves antes de enviar para assinatura.' };
  if (retirante.vinculo === 'procurador' && !procuracaoValidaParaRetirante(agendamento, retirante.cpf)) {
    return { erro: 'Quem retira é procurador: a procuração é obrigatória antes de enviar para assinatura.' };
  }
  if (!retirante.nome || !retirante.email) {
    return { erro: 'Quem retira precisa ter nome e e-mail confirmados.' };
  }

  const textoFinal = String(texto ?? '').trim();
  if (!textoFinal) return { erro: 'O documento está vazio.' };
  const pendente = textoFinal.match(/\{\{\s*\w+\s*\}\}/g);
  if (pendente) return { erro: `Preencha antes de enviar: ${[...new Set(pendente)].join(', ')}` };

  let envelopeId;
  let urlAssinatura;
  try {
    const pdfBase64 = await gerarPdfBase64(textoFinal, NOME_DOCUMENTO[tipo], tipo);
    ({ envelopeId, urlAssinatura } = await criarEnvelopeEmbedded({
      pdfBase64,
      nomeDocumento: NOME_DOCUMENTO[tipo],
      signatario: { nome: retirante.nome, email: retirante.email, clientUserId: agendamento.id },
      retornoUrl: `${url.origin}/admin/entrega-chaves/${agendamento.id}/assinatura-concluida?tipo=${tipo}&origem=${origem}`
    }));
  } catch (err) {
    console.error('DocuSign:', err?.response?.body ?? err);
    return { erro: 'Não foi possível enviar para assinatura (DocuSign). Veja o log do servidor.' };
  }

  await db.documentoAssinado.upsert({
    where: { agendamentoId_tipo: { agendamentoId, tipo } },
    update: { docusignEnvelopeId: envelopeId, status: 'pendente' },
    create: { agendamentoId, tipo, docusignEnvelopeId: envelopeId }
  });

  const u = agendamento.unidade;
  await registrarLog({
    event,
    atorTipo: 'funcionario',
    acao: tipo === 'termo' ? 'termo_enviado_assinatura' : 'checklist_enviado_assinatura',
    descricao: `${rotuloFuncionario(locals.funcionario)} enviou ${NOME_DOCUMENTO[tipo]} da Unidade ${u.numero}, Bloco ${u.bloco} para assinatura — retirada das chaves por ${retirante.nome} (${ROTULO_VINCULO[retirante.vinculo]}, ${retirante.email}); agendamento feito por ${agendamento.nomeCompareceu ?? '—'}`,
    entidadeTipo: 'DocumentoAssinado',
    entidadeId: envelopeId
  });

  throw redirect(303, urlAssinatura);
}
