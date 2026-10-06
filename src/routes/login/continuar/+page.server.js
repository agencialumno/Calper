import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';

export async function load({ locals }) {
  if (!locals.investidor) throw redirect(303, '/login');

  if (locals.investidor.primeiroAcesso) throw redirect(303, '/primeiro-acesso');

  if (locals.unidadeId) throw redirect(303, '/painel');

  const vinculos = await db.unidadeInvestidor.findMany({
    where: { investidorId: locals.investidor.id },
    select: { unidadeId: true }
  });

  if (vinculos.length === 1) throw redirect(303, '/painel'); // hooks popula na próxima requisição
  throw redirect(303, '/login/unidades');
}
