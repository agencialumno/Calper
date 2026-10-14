import { error, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';

const NOMES = { termo: 'termo-entrega-chaves', checklist: 'checklist-entrega-chaves' };

export async function GET({ params, locals }) {
  if (!locals.funcionario) throw redirect(303, '/admin/login');
  if (!NOMES[params.tipo]) throw error(404, 'Documento inválido');

  const doc = await db.documentoAssinado.findUnique({
    where: { agendamentoId_tipo: { agendamentoId: params.id, tipo: params.tipo } },
    include: { agendamento: { include: { unidade: true } } }
  });
  if (!doc || doc.status !== 'assinado' || !doc.pdfBase64) throw error(404, 'Documento ainda não assinado');

  const { bloco, numero } = doc.agendamento.unidade;
  const corpo = Buffer.from(doc.pdfBase64.split(',')[1], 'base64');
  return new Response(corpo, {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${NOMES[params.tipo]}-bloco-${bloco}-${numero}.pdf"`
    }
  });
}
