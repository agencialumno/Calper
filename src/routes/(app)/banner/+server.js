import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';

// Imagem do banner do empreendimento da unidade selecionada na sessão.
// Servida como arquivo (em vez de embutir o base64 no HTML do painel).
export async function GET({ locals }) {
  if (!locals.investidor || !locals.unidadeId) throw error(401, 'Não autenticado');

  const unidade = await db.unidade.findUnique({
    where: { id: locals.unidadeId },
    select: { empreendimento: { select: { bannerImagemBase64: true } } }
  });
  const dataUrl = unidade?.empreendimento.bannerImagemBase64;
  if (!dataUrl) throw error(404, 'Sem banner');

  const tipo = dataUrl.slice(5, dataUrl.indexOf(';'));
  return new Response(Buffer.from(dataUrl.split(',')[1], 'base64'), {
    headers: { 'content-type': tipo }
  });
}
