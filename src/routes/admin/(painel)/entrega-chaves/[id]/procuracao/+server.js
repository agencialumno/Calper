import { error, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';

export async function GET({ params, locals }) {
  if (!locals.funcionario) throw redirect(303, '/admin/login');

  const agendamento = await db.agendamento.findUnique({
    where: { id: params.id },
    select: { procuracaoBase64: true }
  });
  const dataUrl = agendamento?.procuracaoBase64;
  if (!dataUrl) throw error(404, 'Procuração não encontrada');

  const tipo = dataUrl.slice(5, dataUrl.indexOf(';'));
  return new Response(Buffer.from(dataUrl.split(',')[1], 'base64'), {
    headers: { 'content-type': tipo, 'content-disposition': 'inline' }
  });
}
