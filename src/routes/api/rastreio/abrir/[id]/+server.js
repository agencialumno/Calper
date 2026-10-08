import { db } from '$lib/server/db.js';

// Pixel de rastreamento de abertura (1x1, transparente) embutido no e-mail de
// atualização de obra. Carregado = e-mail foi aberto. Marca só a primeira
// abertura (abertoEm começa nulo); nunca falha de um jeito visível — se o
// registro não existir mais, simplesmente devolve o pixel do mesmo jeito.
const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

export async function GET({ params }) {
  try {
    await db.emailEnviado.updateMany({
      where: { id: params.id, abertoEm: null },
      data: { abertoEm: new Date() }
    });
  } catch {
    // rastreio nunca pode quebrar a entrega do pixel
  }

  return new Response(PIXEL_PNG, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store'
    }
  });
}