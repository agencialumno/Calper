import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';

// Documento de identidade enviado no agendamento por quem não é o proprietário (a guarda de /admin exige a sessão).
export async function GET({ params }) {
  const a = await db.agendamento.findUnique({ where: { id: params.id }, select: { documentoBase64: true } });
  const dataUrl = a?.documentoBase64;
  if (!dataUrl) throw error(404, 'Documento de identidade não encontrado');
  const tipo = dataUrl.slice(5, dataUrl.indexOf(';'));
  return new Response(Buffer.from(dataUrl.split(',')[1], 'base64'), {
    headers: { 'content-type': tipo, 'content-disposition': 'inline' }
  });
}
