import { error, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { baixarPdfAssinado, statusDoEnvelope } from '$lib/server/docusign.js';
import { registrarLog, rotuloFuncionario } from '$lib/server/log.js';
import { NOME_DOCUMENTO, ROTA_UNIDADE } from '$lib/server/entregaChaves.js';

// Retorno do DocuSign após o signatário assinar (ou cancelar). Não confia no query string:
// confere o status real do envelope antes de baixar e gravar o PDF.
export async function GET(event) {
  const { params, url, locals } = event;
  if (!locals.funcionario) throw redirect(303, '/admin/login');

  const tipo = url.searchParams.get('tipo');
  const origem = url.searchParams.get('origem') === 'unidade' ? 'unidade' : 'fluxo';
  if (!NOME_DOCUMENTO[tipo]) throw error(400, 'Documento inválido');

  const doc = await db.documentoAssinado.findUnique({
    where: { agendamentoId_tipo: { agendamentoId: params.id, tipo } },
    include: { agendamento: true }
  });
  if (!doc) throw error(404, 'Documento não encontrado');

  const unidadeId = doc.agendamento.unidadeId;
  const passoAtual = tipo === 'termo' ? 3 : 4;
  // volta pra tela de onde o envio partiu
  const voltar = (concluido, aviso) => {
    if (origem === 'unidade') {
      return `/admin/unidades/${unidadeId}/${ROTA_UNIDADE[tipo]}${aviso ? `?aviso=${aviso}` : ''}`;
    }
    const q = new URLSearchParams({ passo: String(concluido ? passoAtual + 1 : passoAtual) });
    if (aviso) q.set('aviso', aviso);
    return `/admin/entrega-chaves/${params.id}?${q}`;
  };

  if (doc.status === 'assinado') throw redirect(303, voltar(true));

  const status = await statusDoEnvelope(doc.docusignEnvelopeId);
  if (status !== 'completed') throw redirect(303, voltar(false, 'nao-assinado'));

  const pdfBase64 = await baixarPdfAssinado(doc.docusignEnvelopeId);
  const agendamento = await db.agendamento.findUnique({
    where: { id: params.id },
    include: { unidade: true, documentosAssinados: { select: { tipo: true, status: true } } }
  });
  const rotuloUnidade = `Unidade ${agendamento.unidade.numero}, Bloco ${agendamento.unidade.bloco}`;

  await db.documentoAssinado.update({
    where: { id: doc.id },
    data: { status: 'assinado', pdfBase64, assinadoEm: new Date() }
  });
  await db.historicoUnidade.create({
    data: {
      unidadeId,
      tipo: 'documento',
      descricao: `${NOME_DOCUMENTO[tipo]} assinado via DocuSign`,
      criadoPorId: locals.funcionario.id
    }
  });
  await registrarLog({
    event,
    atorTipo: 'funcionario',
    acao: 'documento_assinado',
    descricao: `${NOME_DOCUMENTO[tipo]} da ${rotuloUnidade} assinado via DocuSign por ${agendamento.retiranteNome ?? 'signatário'} (agendamento feito por ${agendamento.nomeCompareceu ?? '—'}; atendente: ${rotuloFuncionario(locals.funcionario)})`,
    entidadeTipo: 'DocumentoAssinado',
    entidadeId: doc.id
  });

  // termo + checklist assinados = entrega concluída; a unidade sai do dropdown de agendamento
  const outroTipo = tipo === 'termo' ? 'checklist' : 'termo';
  const outroAssinado = agendamento.documentosAssinados.some((d) => d.tipo === outroTipo && d.status === 'assinado');
  if (outroAssinado && agendamento.status !== 'realizado') {
    await db.agendamento.update({ where: { id: agendamento.id }, data: { status: 'realizado' } });
    await db.historicoUnidade.create({
      data: {
        unidadeId,
        tipo: 'evento_realizado',
        descricao: 'Entrega de chaves concluída (termo e checklist assinados)',
        criadoPorId: locals.funcionario.id
      }
    });
    await registrarLog({
      event,
      atorTipo: 'funcionario',
      acao: 'entrega_concluida',
      descricao: `Entrega de chaves da ${rotuloUnidade} concluída — termo e checklist assinados (atendente: ${rotuloFuncionario(locals.funcionario)})`,
      entidadeTipo: 'Agendamento',
      entidadeId: agendamento.id
    });
  }

  throw redirect(303, voltar(true));
}
