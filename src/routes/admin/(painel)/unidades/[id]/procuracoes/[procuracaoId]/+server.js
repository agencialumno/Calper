import { error, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';

export async function GET({ params, locals }) {
  if (!locals.funcionario) throw redirect(303, '/admin/login');

  const procuracao = await db.procuracaoUnidade.findFirst({
    where: { id: params.procuracaoId, unidadeId: params.id },
    select: { arquivoBase64: true }
  });
  if (!procuracao) throw error(404, 'Procuração não encontrada');

  const dataUrl = procuracao.arquivoBase64;
  const tipo = dataUrl.slice(5, dataUrl.indexOf(';'));
  return new Response(Buffer.from(dataUrl.split(',')[1], 'base64'), {
    headers: { 'content-type': tipo, 'content-disposition': 'inline' }
  });
}
