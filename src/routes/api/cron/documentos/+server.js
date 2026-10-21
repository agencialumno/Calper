// Disparado uma vez por dia pelo Vercel Cron (ver vercel.json) — confere no DocuSign os documentos da
// entrega de chaves que ainda aguardam assinatura e atualiza o banco (aguardando_cliente / assinado).
// Protegido pelo CRON_SECRET, como o cron de lembretes.
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db.js';
import { sincronizarDocumento } from '$lib/server/entregaChaves.js';

export async function GET({ request }) {
  if (env.CRON_SECRET) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${env.CRON_SECRET}`) {
      return json({ erro: 'Não autorizado.' }, { status: 401 });
    }
  }

  const documentos = await db.documentoAssinado.findMany({
    where: { status: { in: ['pendente', 'calper_assinou', 'aguardando_cliente'] } }
  });
  let atualizados = 0;
  for (const doc of documentos) {
    try {
      if ((await sincronizarDocumento(doc)).status !== doc.status) atualizados++;
    } catch (err) {
      console.error('Cron documentos:', doc.id, err?.response?.body ?? err);
    }
  }
  return json({ conferidos: documentos.length, atualizados });
}
