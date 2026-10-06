import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { definirUnidadeNaSessao, hashSenha } from '$lib/server/auth.js';

export function load({ locals }) {
  if (!locals.investidor) throw redirect(303, '/login');
  if (!locals.investidor.primeiroAcesso) throw redirect(303, '/login/continuar');
}

export const actions = {
  default: async ({ request, locals }) => {
    if (!locals.investidor) throw redirect(303, '/login');

    const form = await request.formData();
    const novaSenha = String(form.get('novaSenha') ?? '');
    const confirmarSenha = String(form.get('confirmarSenha') ?? '');

    if (novaSenha.length < 8) {
      return fail(400, { erro: 'A senha precisa ter pelo menos 8 caracteres.' });
    }
    if (novaSenha !== confirmarSenha) {
      return fail(400, { erro: 'As senhas não coincidem.' });
    }

    await db.investidor.update({
      where: { id: locals.investidor.id },
      data: { senhaHash: hashSenha(novaSenha), primeiroAcesso: false }
    });

    const vinculos = await db.unidadeInvestidor.findMany({
      where: { investidorId: locals.investidor.id },
      select: { unidadeId: true }
    });

    if (vinculos.length === 1 && locals.sessionToken) {
      await definirUnidadeNaSessao(locals.sessionToken, vinculos[0].unidadeId);
    }

    throw redirect(303, vinculos.length > 1 ? '/login/unidades' : '/painel');
  }
};
