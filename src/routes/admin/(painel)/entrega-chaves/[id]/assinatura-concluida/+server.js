import { error, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { baixarPdfAssinado, statusDoEnvelope } from '$lib/server/docusign.js';
import { registrarLog, rotuloFuncionario } from '$lib/server/log.js';

// Retorno do DocuSign após o signatário assinar (ou cancelar). Não confia no query string:
// confere o status real do envelope antes de baixar e gravar o PDF.
export async function GET(event) {
  const { params, url, locals } = event;
  if (!locals.funcionario) throw redirect(303, '/admin/login');

  const tipo = url.searchParams.get('tipo');
  const quem = url.searchParams.get('quem') ?? '';
  if (!['termo', 'checklist'].includes(tipo)) throw error(400, 'Documento inválido');

  const doc = await db.documentoAssinado.findUnique({
    where: { agendamentoId_tipo: { agendamentoId: params.id, tipo } }
  });
  if (!doc) throw error(404, 'Documento não encontrado');

  const passoAtual = tipo === 'termo' ? 3 : 4;
  const voltar = (passo, aviso) => {
    const q = new URLSearchParams({ passo: String(passo), quem });
    if (aviso) q.set('aviso', aviso);
    return `/admin/entrega-chaves/${params.id}?${q}`;
  };

  if (doc.status === 'assinado') throw redirect(303, voltar(passoAtual + 1));

  const status = await statusDoEnvelope(doc.docusignEnvelopeId);
  if (status !== 'completed') throw redirect(303, voltar(passoAtual, 'nao-assinado'));

  const pdfBase64 = await baixarPdfAssinado(doc.docusignEnvelopeId);
  const agendamento = await db.agendamento.findUnique({
    where: { id: params.id },
    include: { unidade: true }
  });

  await db.documentoAssinado.update({
    where: { id: doc.id },
    data: { status: 'assinado', pdfBase64, assinadoEm: new Date() }
  });
  await db.historicoUnidade.create({
    data: {
      unidadeId: agendamento.unidadeId,
      tipo: 'documento',
      descricao: `${tipo === 'termo' ? 'Termo de entrega de chaves' : 'Checklist de entrega'} assinado via DocuSign`,
      criadoPorId: locals.funcionario.id
    }
  });

  await registrarLog({
    event,
    atorTipo: 'funcionario',
    acao: 'documento_assinado',
    descricao: `${tipo === 'termo' ? 'Termo de entrega de chaves' : 'Checklist'} da Unidade ${agendamento.unidade.numero}, Bloco ${agendamento.unidade.bloco} assinado via DocuSign (atendente: ${rotuloFuncionario(locals.funcionario)})`,
    entidadeTipo: 'DocumentoAssinado',
    entidadeId: doc.id
  });

  throw redirect(303, voltar(passoAtual + 1));
}
