import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { definirUnidadeNaSessao, hashSenha } from '$lib/server/auth.js';
import { senhaAceitavel } from '$lib/password.js';

export async function load({ locals }) {
  if (!locals.investidor) throw redirect(303, '/login');
  if (!locals.investidor.primeiroAcesso) throw redirect(303, '/login/continuar');

  // pré-preenche com o e-mail que já veio da importação, se tiver um
  const vinculo = await db.unidadeInvestidor.findFirst({ where: { investidorId: locals.investidor.id } });

  return { emailAtual: vinculo?.email ?? '' };
}

export const actions = {
  default: async ({ request, locals }) => {
    if (!locals.investidor) throw redirect(303, '/login');

    const form = await request.formData();
    const novaSenha = String(form.get('novaSenha') ?? '');
    const confirmarSenha = String(form.get('confirmarSenha') ?? '');
    const email = String(form.get('email') ?? '').trim();

    if (!senhaAceitavel(novaSenha)) {
      return fail(400, {
        erro: 'Sua senha precisa atingir pelo menos o nível "forte": 8+ caracteres, maiúscula, minúscula, número e caractere especial (ao menos 4 desses 5 requisitos).'
      });
    }
    if (novaSenha !== confirmarSenha) {
      return fail(400, { erro: 'As senhas não coincidem.' });
    }
    if (!email || !email.includes('@') || !email.includes('.')) {
      return fail(400, { erro: 'Informe um e-mail válido — é pra ele que vamos mandar suas notificações.' });
    }

    await db.investidor.update({
      where: { id: locals.investidor.id },
      data: { senhaHash: hashSenha(novaSenha), primeiroAcesso: false }
    });

    // o e-mail é definido uma única vez aqui, no primeiro acesso — depois
    // disso só o time Calper consegue alterar, pelo dossiê da unidade
    const vinculos = await db.unidadeInvestidor.findMany({
      where: { investidorId: locals.investidor.id },
      select: { unidadeId: true }
    });

    await db.unidadeInvestidor.updateMany({
      where: { investidorId: locals.investidor.id },
      data: { email }
    });

    if (vinculos.length === 1 && locals.sessionToken) {
      await definirUnidadeNaSessao(locals.sessionToken, vinculos[0].unidadeId);
    }

    throw redirect(303, vinculos.length > 1 ? '/login/unidades' : '/painel');
  }
};