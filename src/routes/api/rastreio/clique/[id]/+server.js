import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';

// Link de "acompanhar a jornada" no e-mail passa por aqui antes de ir pro
// painel — marca o clique e redireciona. Só aceita destino relativo (começa
// com "/") pra não virar open redirect.
export async function GET({ params, url }) {
  const destinoBruto = url.searchParams.get('destino') ?? '/jornada';
  const destino = destinoBruto.startsWith('/') ? destinoBruto : '/jornada';

  try {
    await db.emailEnviado.updateMany({
      where: { id: params.id, clicadoEm: null },
      data: { clicadoEm: new Date() }
    });
  } catch {
    // rastreio nunca pode impedir o redirecionamento
  }

  throw redirect(302, destino);
}