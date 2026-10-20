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
import {
  assinanteDaCalper,
  baixarPdfAssinado,
  criarEnvelopeEntrega,
  destinatarioDaCopia,
  situacaoDoEnvelope
} from './docusign.js';
import { gerarPdfBase64 } from './documentos.js';
import { registrarLog, rotuloFuncionario } from './log.js';

export const NOME_DOCUMENTO = {
  termo: 'Termo de Entrega de Chaves',
  checklist: 'Checklist - Entrega de Chaves'
};

export const ROTA_UNIDADE = { termo: 'termo-entrega', checklist: 'checklist' };

// Ordem do atendimento: o checklist vem antes do termo. Passos do fluxo: 3 = checklist, 4 = termo, 5 = concluído.
export const ORDEM_DOCUMENTOS = ['checklist', 'termo'];
export const PASSO_DO_DOCUMENTO = { checklist: 3, termo: 4 };

// Estados de um documento: pendente (criado, a Calper ainda não assinou) → aguardando_cliente (a Calper
// assinou e o DocuSign mandou o e-mail ao cliente/cônjuge) → assinado (envelope concluído por todos).
export const ROTULO_STATUS_DOCUMENTO = {
  pendente: 'aguardando a assinatura da Calper',
  aguardando_cliente: 'Calper assinou — aguardando o cliente',
  assinado: 'assinado por todos'
};

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

/** Quem assina junto com quem retira: o cliente (retirante) e, quando informado no passo 2, o cônjuge. */
export function signatariosDoCliente(agendamento, retirante) {
  const conjuge =
    agendamento.conjugeNome && agendamento.conjugeEmail
      ? { nome: agendamento.conjugeNome, email: agendamento.conjugeEmail }
      : null;
  return { cliente: { nome: retirante.nome, email: retirante.email }, conjuge };
}

/**
 * Cria o envelope no DocuSign pro texto final e leva o atendente pra tela de assinatura da Calper
 * (iframe no admin). O cliente (e o cônjuge) só recebem o e-mail do DocuSign depois que a Calper assina;
 * quando o envelope fecha, a cópia carbono recebe o PDF final.
 * Devolve { erro } quando algo impede o envio (nada é lançado nesse caso).
 * `origem`: 'fluxo' (passo a passo da entrega) ou 'unidade' (rotas /admin/unidades/[id]/...).
 */
export async function enviarDocumentoParaAssinatura(event, { agendamentoId, tipo, texto, origem }) {
  const { locals } = event;
  if (!NOME_DOCUMENTO[tipo]) return { erro: 'Documento inválido.' };

  const agendamento = await db.agendamento.findUnique({
    where: { id: agendamentoId },
    include: { unidade: true, presencas: true, documentosAssinados: { select: { tipo: true, status: true } } }
  });
  if (!agendamento) return { erro: 'Agendamento não encontrado.' };

  const existente = agendamento.documentosAssinados.find((d) => d.tipo === tipo);
  if (existente?.status === 'assinado') return { erro: 'Este documento já foi assinado.' };
  if (existente?.status === 'aguardando_cliente') {
    return { erro: 'A Calper já assinou este documento: ele está aguardando a assinatura do cliente.' };
  }

  // o termo só começa depois que a Calper assinou o checklist
  if (tipo === 'termo') {
    const checklist = agendamento.documentosAssinados.find((d) => d.tipo === 'checklist');
    if (!['aguardando_cliente', 'assinado'].includes(checklist?.status)) {
      return { erro: 'Assine o checklist primeiro: o termo vem depois dele.' };
    }
  }

  const retirante = retiranteDoAgendamento(agendamento);
  if (!retirante) return { erro: 'Confirme quem está retirando as chaves antes de enviar para assinatura.' };
  if (retirante.vinculo === 'procurador' && !procuracaoValidaParaRetirante(agendamento, retirante.cpf)) {
    return { erro: 'Quem retira é procurador: a procuração é obrigatória antes de enviar para assinatura.' };
  }
  if (!retirante.nome || !retirante.email) {
    return { erro: 'Quem retira precisa ter nome e e-mail confirmados.' };
  }
  const { cliente, conjuge } = signatariosDoCliente(agendamento, retirante);

  const textoFinal = String(texto ?? '').trim();
  if (!textoFinal) return { erro: 'O documento está vazio.' };
  const pendente = textoFinal.match(/\{\{\s*\w+\s*\}\}/g);
  if (pendente) return { erro: `Preencha antes de enviar: ${[...new Set(pendente)].join(', ')}` };

  let envelopeId;
  let comCopia;
  try {
    const pdfBase64 = await gerarPdfBase64(textoFinal, NOME_DOCUMENTO[tipo], tipo);
    const [calper, copia] = await Promise.all([assinanteDaCalper(), destinatarioDaCopia()]);
    ({ envelopeId, comCopia } = await criarEnvelopeEntrega({
      pdfBase64,
      nomeDocumento: NOME_DOCUMENTO[tipo],
      calper: { nome: calper.nome, email: calper.email, clientUserId: agendamento.id },
      cliente,
      conjuge,
      copia
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
    descricao: `${rotuloFuncionario(locals.funcionario)} enviou ${NOME_DOCUMENTO[tipo]} da Unidade ${u.numero}, Bloco ${u.bloco} para assinatura — Calper assina primeiro; depois ${cliente.nome} (${ROTULO_VINCULO[retirante.vinculo]}, ${cliente.email})${conjuge ? ` e ${conjuge.nome} (cônjuge, ${conjuge.email})` : ''} recebem o link por e-mail${comCopia ? '; a cópia do documento final vai para o e-mail da Calper' : ''}; agendamento feito por ${agendamento.nomeCompareceu ?? '—'}`,
    entidadeTipo: 'DocumentoAssinado',
    entidadeId: envelopeId
  });

  // a cerimônia de assinatura da Calper roda num iframe dentro do admin (tela /assinar)
  throw redirect(303, `/admin/entrega-chaves/${agendamento.id}/assinar?tipo=${tipo}&origem=${origem}`);
}

/**
 * Confere no DocuSign em que ponto está um documento e atualiza o banco:
 *  - Calper assinou, cliente ainda não → "aguardando_cliente";
 *  - envelope concluído → baixa o PDF final, marca "assinado" e, com os dois documentos assinados, a entrega fica "realizada".
 * `event` (opcional) serve só para registrar IP/ator nos logs; sem ele (cron) os logs saem como sistema.
 * Devolve o status resultante do documento.
 */
export async function sincronizarDocumento(documento, event = null) {
  if (documento.status === 'assinado') return 'assinado';

  const situacao = await situacaoDoEnvelope(documento.docusignEnvelopeId);
  const log = (dados) => registrarLog({ event: event ?? { locals: {}, getClientAddress: () => null, request: { headers: new Headers() } }, atorTipo: 'funcionario', ...dados });

  const agendamento = await db.agendamento.findUnique({
    where: { id: documento.agendamentoId },
    include: { unidade: true, documentosAssinados: { select: { tipo: true, status: true } } }
  });
  const u = agendamento.unidade;
  const local = `Unidade ${u.numero}, Bloco ${u.bloco}`;
  const nome = NOME_DOCUMENTO[documento.tipo];
  const atendente = event?.locals?.funcionario;

  if (situacao.status === 'completed') {
    const pdfBase64 = await baixarPdfAssinado(documento.docusignEnvelopeId);
    await db.documentoAssinado.update({
      where: { id: documento.id },
      data: { status: 'assinado', pdfBase64, assinadoEm: new Date() }
    });
    await db.historicoUnidade.create({
      data: {
        unidadeId: u.id,
        tipo: 'documento',
        descricao: `${nome} assinado via DocuSign`,
        criadoPorId: atendente?.id ?? null
      }
    });
    await log({
      funcionarioId: atendente?.id,
      acao: 'documento_assinado',
      descricao: `${nome} da ${local} assinado por todos via DocuSign (agendamento feito por ${agendamento.nomeCompareceu ?? '—'}${atendente ? `; atendente: ${rotuloFuncionario(atendente)}` : ''})`,
      entidadeTipo: 'DocumentoAssinado',
      entidadeId: documento.id
    });

    // checklist e termo assinados por todos = entrega concluída; a unidade sai do dropdown de agendamento
    const outro = ORDEM_DOCUMENTOS.find((t) => t !== documento.tipo);
    const outroAssinado = agendamento.documentosAssinados.some((d) => d.tipo === outro && d.status === 'assinado');
    if (outroAssinado && agendamento.status !== 'realizado') {
      await db.agendamento.update({ where: { id: agendamento.id }, data: { status: 'realizado' } });
      await db.historicoUnidade.create({
        data: {
          unidadeId: u.id,
          tipo: 'evento_realizado',
          descricao: 'Entrega de chaves concluída (checklist e termo assinados)',
          criadoPorId: atendente?.id ?? null
        }
      });
      await log({
        funcionarioId: atendente?.id,
        acao: 'entrega_concluida',
        descricao: `Entrega de chaves da ${local} concluída — checklist e termo assinados por todos`,
        entidadeTipo: 'Agendamento',
        entidadeId: agendamento.id
      });
    }
    return 'assinado';
  }

  if (situacao.calperAssinou && documento.status === 'pendente') {
    await db.documentoAssinado.update({ where: { id: documento.id }, data: { status: 'aguardando_cliente' } });
    await log({
      funcionarioId: atendente?.id,
      acao: 'documento_assinado_calper',
      descricao: `${nome} da ${local} assinado pela Calper; o DocuSign enviou o link por e-mail para ${situacao.clientesPendentes.map((c) => c.nome).join(' e ')}`,
      entidadeTipo: 'DocumentoAssinado',
      entidadeId: documento.id
    });
    return 'aguardando_cliente';
  }

  return documento.status;
}
