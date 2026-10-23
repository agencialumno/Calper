import { error, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { juntarPdfs } from '$lib/server/documentos.js';

const NOMES = { termo: 'termo-entrega-chaves', checklist: 'checklist-entrega-chaves', completo: 'entrega-chaves-completo' };

const pdfDe = (doc) => Buffer.from(doc.pdfBase64.split(',')[1], 'base64');

// PDF assinado. "completo" junta o termo e o checklist assinados (nessa ordem) num único arquivo.
export async function GET({ params, locals }) {
  if (!locals.funcionario) throw redirect(303, '/admin/login');
  if (!NOMES[params.tipo]) throw error(404, 'Documento inválido');

  const agendamento = await db.agendamento.findUnique({
    where: { id: params.id },
    select: {
      unidade: { select: { bloco: true, numero: true } },
      documentosAssinados: { where: { status: 'assinado' }, select: { tipo: true, pdfBase64: true } }
    }
  });
  if (!agendamento) throw error(404, 'Agendamento não encontrado');
  const assinados = agendamento.documentosAssinados.filter((d) => d.pdfBase64);

  let corpo;
  if (params.tipo === 'completo') {
    const partes = ['termo', 'checklist'].map((t) => assinados.find((d) => d.tipo === t));
    if (partes.some((d) => !d)) throw error(404, 'O PDF completo só existe depois que termo e checklist forem assinados por todos');
    corpo = await juntarPdfs(partes.map(pdfDe));
  } else {
    const doc = assinados.find((d) => d.tipo === params.tipo);
    if (!doc) throw error(404, 'Documento ainda não assinado');
    corpo = pdfDe(doc);
  }

  const { bloco, numero } = agendamento.unidade;
  return new Response(corpo, {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${NOMES[params.tipo]}-bloco-${bloco}-${numero}.pdf"`
    }
  });
}
