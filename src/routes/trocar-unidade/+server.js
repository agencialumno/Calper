import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { definirUnidadeNaSessao } from '$lib/server/auth.js';

export async function POST({ request, locals }) {
  if (!locals.investidor || !locals.sessionToken) throw redirect(303, '/login');

  const form = await request.formData();
  const unidadeId = String(form.get('unidadeId') ?? '');

  const vinculo = await db.unidadeInvestidor.findFirst({
    where: { investidorId: locals.investidor.id, unidadeId }
  });
  if (vinculo) await definirUnidadeNaSessao(locals.sessionToken, unidadeId);

  throw redirect(303, '/painel');
}
