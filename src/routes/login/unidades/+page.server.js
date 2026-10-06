import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { definirUnidadeNaSessao } from '$lib/server/auth.js';

export async function load({ locals }) {
  if (!locals.investidor) throw redirect(303, '/login');
  if (locals.investidor.primeiroAcesso) throw redirect(303, '/primeiro-acesso');

  const vinculos = await db.unidadeInvestidor.findMany({
    where: { investidorId: locals.investidor.id },
    include: { unidade: { include: { empreendimento: true } } }
  });

  if (vinculos.length <= 1) throw redirect(303, '/painel');

  return {
    unidades: vinculos.map((v) => ({
      id: v.unidade.id,
      numero: v.unidade.numero,
      bloco: v.unidade.bloco,
      empreendimento: v.unidade.empreendimento.nome
    }))
  };
}

export const actions = {
  escolher: async ({ request, locals, cookies }) => {
    if (!locals.investidor || !locals.sessionToken) throw redirect(303, '/login');

    const form = await request.formData();
    const unidadeId = String(form.get('unidadeId') ?? '');

    const vinculo = await db.unidadeInvestidor.findFirst({
      where: { investidorId: locals.investidor.id, unidadeId }
    });
    if (!vinculo) return fail(400, { erro: 'Unidade inválida.' });

    await definirUnidadeNaSessao(locals.sessionToken, unidadeId);
    throw redirect(303, '/painel');
  }
};
