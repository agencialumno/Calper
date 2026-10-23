import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';

const NOMES = { termo: 'termo-entrega-chaves', checklist: 'checklist-entrega-chaves' };

// PDF assinado cujo agendamento foi apagado (continua ligado à unidade). A guarda de /admin exige a sessão da equipe.
export async function GET({ params }) {
  const doc = await db.documentoAssinado.findFirst({
    where: { id: params.docId, unidadeId: params.id, status: 'assinado' },
    include: { unidade: { select: { bloco: true, numero: true } } }
  });
  if (!doc?.pdfBase64) throw error(404, 'Documento não encontrado');
  return new Response(Buffer.from(doc.pdfBase64.split(',')[1], 'base64'), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${NOMES[doc.tipo] ?? doc.tipo}-bloco-${doc.unidade.bloco}-${doc.unidade.numero}.pdf"`
    }
  });
}
