import { db } from './db.js';
import { SLUG_ENTREGA_CHAVES, buscarMurano } from './murano.js';

// (a base do Murano mora em ./murano.js, sem dependências de DocuSign; reexportada aqui por compatibilidade)
export { SLUG_ENTREGA_CHAVES, buscarMurano };

// --- assinatura dos documentos (termo / checklist) ---

import { redirect } from '@sveltejs/kit';
import {
  DOCUMENTO_ID,
  anexarChecklist,
  anularEnvelope,
  assinanteDaCalper,
  baixarPdfAssinado,
  clientUserIdChecklist,
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

// Ordem do atendimento: o termo vem antes do checklist. Passos do fluxo: 3 = termo, 4 = checklist, 5 = concluído.
export const ORDEM_DOCUMENTOS = ['termo', 'checklist'];
export const PASSO_DO_DOCUMENTO = { termo: 3, checklist: 4 };

// Os dois documentos vão no MESMO envelope do DocuSign. Estados de um documento:
// pendente (a Calper ainda não assinou este documento) → calper_assinou (a Calper assinou este documento, mas o
// envelope ainda não foi liberado ao cliente: falta a Calper assinar o outro) → aguardando_cliente (Calper assinou
// os dois; cliente/cônjuge receberam um único e-mail) → assinado (envelope concluído por todos).
export const ROTULO_STATUS_DOCUMENTO = {
  pendente: 'aguardando a assinatura da Calper',
  calper_assinou: 'Calper assinou — aguardando o checklist',
  aguardando_cliente: 'Calper assinou — aguardando o cliente',
  assinado: 'assinado por todos'
};
/** Estados em que a Calper já assinou o documento. */
export const CALPER_JA_ASSINOU = ['calper_assinou', 'aguardando_cliente', 'assinado'];

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
 * Leva o documento pra assinatura da Calper (iframe no admin). Os dois documentos da entrega ficam num único
 * envelope do DocuSign: o termo cria o envelope; o checklist é anexado a ele depois que a Calper assinou o termo.
 * O cliente (e o cônjuge) recebem UM e-mail, com os dois documentos, só depois que a Calper assinou os dois;
 * quando o envelope fecha, a cópia carbono recebe o PDF final.
 * Devolve { erro } quando algo impede o envio (nada é lançado nesse caso).
 * `origem`: 'fluxo' (passo a passo da entrega) ou 'unidade' (rotas /admin/unidades/[id]/...).
 */
export async function enviarDocumentoParaAssinatura(event, { agendamentoId, tipo, texto, origem }) {
  const { locals } = event;
  if (!NOME_DOCUMENTO[tipo]) return { erro: 'Documento inválido.' };

  const agendamento = await db.agendamento.findUnique({
    where: { id: agendamentoId },
    include: { unidade: true, presencas: true, documentosAssinados: true }
  });
  if (!agendamento) return { erro: 'Agendamento não encontrado.' };
  if (agendamento.status === 'cancelado') return { erro: 'Este agendamento foi cancelado: não dá para enviar documentos.' };

  const doc = (t) => agendamento.documentosAssinados.find((d) => d.tipo === t);
  const existente = doc(tipo);
  if (CALPER_JA_ASSINOU.includes(existente?.status)) {
    return { erro: 'A Calper já assinou este documento.' };
  }
  const irParaAssinatura = () =>
    redirect(303, `/admin/entrega-chaves/${agendamento.id}/assinar?tipo=${tipo}&origem=${origem}`);

  // o checklist só entra depois que a Calper assinou o termo (ele é anexado ao envelope do termo)
  if (tipo === 'checklist' && !CALPER_JA_ASSINOU.includes(doc('termo')?.status)) {
    return { erro: 'Assine o termo primeiro: o checklist vem depois dele.' };
  }
  // checklist já anexado e ainda sem a assinatura da Calper: só retoma a assinatura (o anexo não é substituível)
  if (tipo === 'checklist' && existente?.status === 'pendente') throw irParaAssinatura();

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
  let comCopia = false;
  try {
    const pdfBase64 = await gerarPdfBase64(textoFinal, NOME_DOCUMENTO[tipo], tipo);
    if (tipo === 'termo') {
      const [calper, copia] = await Promise.all([assinanteDaCalper(), destinatarioDaCopia()]);
      ({ envelopeId, comCopia } = await criarEnvelopeEntrega({
        pdfBase64,
        nomeDocumento: NOME_DOCUMENTO.termo,
        calper: { nome: calper.nome, email: calper.email, clientUserId: agendamento.id },
        cliente,
        conjuge,
        copia
      }));
      // reenvio do termo (texto corrigido antes de a Calper assinar): o envelope anterior fica sem uso
      if (existente?.docusignEnvelopeId) await anularEnvelope(existente.docusignEnvelopeId, 'termo reenviado com outro texto');
    } else {
      envelopeId = doc('termo').docusignEnvelopeId;
      const calper = await assinanteDaCalper();
      await anexarChecklist({ envelopeId, pdfBase64, nomeDocumento: NOME_DOCUMENTO.checklist, calper, cliente, conjuge });
    }
  } catch (err) {
    console.error('DocuSign:', err?.response?.body ?? err);
    return { erro: 'Não foi possível enviar para assinatura (DocuSign). Veja o log do servidor.' };
  }

  await db.documentoAssinado.upsert({
    where: { agendamentoId_tipo: { agendamentoId, tipo } },
    update: { docusignEnvelopeId: envelopeId, status: 'pendente' },
    // unidadeId: o documento assinado continua ligado à unidade mesmo que o agendamento seja apagado um dia
    create: { agendamentoId, unidadeId: agendamento.unidadeId, tipo, docusignEnvelopeId: envelopeId }
  });

  const u = agendamento.unidade;
  await registrarLog({
    event,
    atorTipo: 'funcionario',
    acao: tipo === 'termo' ? 'termo_enviado_assinatura' : 'checklist_enviado_assinatura',
    descricao:
      tipo === 'termo'
        ? `${rotuloFuncionario(locals.funcionario)} abriu o envelope de assinatura com o ${NOME_DOCUMENTO.termo} da Unidade ${u.numero}, Bloco ${u.bloco} — Calper assina primeiro; depois ${cliente.nome} (${ROTULO_VINCULO[retirante.vinculo]}, ${cliente.email})${conjuge ? ` e ${conjuge.nome} (cônjuge, ${conjuge.email})` : ''} recebem um único e-mail com termo e checklist${comCopia ? '; a cópia do documento final vai para o e-mail da Calper' : ''}; agendamento feito por ${agendamento.nomeCompareceu ?? '—'}`
        : `${rotuloFuncionario(locals.funcionario)} anexou o ${NOME_DOCUMENTO.checklist} ao envelope da Unidade ${u.numero}, Bloco ${u.bloco} para assinatura da Calper`,
    entidadeTipo: 'DocumentoAssinado',
    entidadeId: envelopeId
  });

  // a cerimônia de assinatura da Calper roda num iframe dentro do admin (tela /assinar)
  throw irParaAssinatura();
}

/**
 * Confere no DocuSign em que ponto está o envelope e atualiza os documentos dele no banco:
 *  - Calper assinou o termo → "calper_assinou"; assinou também o checklist → "aguardando_cliente";
 *  - envelope concluído → baixa o PDF assinado de cada documento, marca "assinado" e a entrega fica "realizada".
 * `event` (opcional) serve só para registrar IP/ator nos logs; sem ele (cron) os logs saem como sistema.
 * Devolve { status, clientesPendentes }: o status resultante do `documento` e quem ainda não assinou.
 */
export async function sincronizarDocumento(documento, event = null) {
  if (documento.status === 'assinado') return { status: 'assinado', clientesPendentes: [] };
  // agendamento apagado: o documento fica guardado, mas não há mais entrega para atualizar
  if (!documento.agendamentoId) return { status: documento.status, clientesPendentes: [] };

  const situacao = await situacaoDoEnvelope(documento.docusignEnvelopeId);
  const log = (dados) =>
    registrarLog({
      event: event ?? { locals: {}, getClientAddress: () => null, request: { headers: new Headers() } },
      atorTipo: 'funcionario',
      ...dados
    });

  const agendamento = await db.agendamento.findUnique({
    where: { id: documento.agendamentoId },
    include: { unidade: true, documentosAssinados: true }
  });
  const u = agendamento.unidade;
  const local = `Unidade ${u.numero}, Bloco ${u.bloco}`;
  const atendente = event?.locals?.funcionario;
  // os documentos que moram neste envelope
  const doEnvelope = agendamento.documentosAssinados.filter((d) => d.docusignEnvelopeId === documento.docusignEnvelopeId);

  const calperAssinou = (tipo) => (tipo === 'termo' ? situacao.calperTermoAssinou : situacao.calperChecklistAssinou);
  const statusDe = (tipo) => {
    if (situacao.status === 'completed') return 'assinado';
    if (!calperAssinou(tipo)) return 'pendente';
    return situacao.calperTermoAssinou && situacao.calperChecklistAssinou ? 'aguardando_cliente' : 'calper_assinou';
  };

  for (const d of doEnvelope) {
    const novo = statusDe(d.tipo);
    if (novo === d.status) continue;
    const nome = NOME_DOCUMENTO[d.tipo];

    if (novo === 'assinado') {
      const pdfBase64 = await baixarPdfAssinado(d.docusignEnvelopeId, DOCUMENTO_ID[d.tipo]);
      await db.documentoAssinado.update({ where: { id: d.id }, data: { status: 'assinado', pdfBase64, assinadoEm: new Date() } });
      await db.historicoUnidade.create({
        data: { unidadeId: u.id, tipo: 'documento', descricao: `${nome} assinado via DocuSign`, criadoPorId: atendente?.id ?? null }
      });
      await log({
        funcionarioId: atendente?.id,
        acao: 'documento_assinado',
        descricao: `${nome} da ${local} assinado por todos via DocuSign (agendamento feito por ${agendamento.nomeCompareceu ?? '—'}${atendente ? `; atendente: ${rotuloFuncionario(atendente)}` : ''})`,
        entidadeTipo: 'DocumentoAssinado',
        entidadeId: d.id
      });
    } else {
      await db.documentoAssinado.update({ where: { id: d.id }, data: { status: novo } });
      await log({
        funcionarioId: atendente?.id,
        acao: 'documento_assinado_calper',
        descricao:
          novo === 'aguardando_cliente'
            ? `${nome} da ${local} assinado pela Calper; o DocuSign enviou um único e-mail (termo e checklist) para ${situacao.clientesPendentes.map((c) => c.nome).join(' e ')}`
            : `${nome} da ${local} assinado pela Calper (o cliente só recebe o e-mail depois do checklist)`,
        entidadeTipo: 'DocumentoAssinado',
        entidadeId: d.id
      });
    }
    d.status = novo;
  }

  // termo e checklist assinados por todos = entrega concluída; a unidade sai do dropdown de agendamento
  const todosAssinados = ORDEM_DOCUMENTOS.every((t) => agendamento.documentosAssinados.find((d) => d.tipo === t)?.status === 'assinado');
  if (todosAssinados && agendamento.status !== 'realizado') {
    await db.agendamento.update({ where: { id: agendamento.id }, data: { status: 'realizado' } });
    await db.historicoUnidade.create({
      data: { unidadeId: u.id, tipo: 'evento_realizado', descricao: 'Entrega de chaves concluída (termo e checklist assinados)', criadoPorId: atendente?.id ?? null }
    });
    await log({
      funcionarioId: atendente?.id,
      acao: 'entrega_concluida',
      descricao: `Entrega de chaves da ${local} concluída — termo e checklist assinados por todos`,
      entidadeTipo: 'Agendamento',
      entidadeId: agendamento.id
    });
  }

  return {
    status: doEnvelope.find((d) => d.id === documento.id)?.status ?? documento.status,
    clientesPendentes: situacao.clientesPendentes
  };
}
