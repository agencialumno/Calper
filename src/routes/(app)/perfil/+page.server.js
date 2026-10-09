import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { hashSenha, verificarSenha } from '$lib/server/auth.js';
import { senhaAceitavel } from '$lib/password.js';

export const actions = {
  senha: async ({ request, locals }) => {
    const form = await request.formData();
    const senhaAtual = String(form.get('senhaAtual') ?? '');
    const novaSenha = String(form.get('novaSenha') ?? '');
    const confirmarSenha = String(form.get('confirmarSenha') ?? '');

    if (!verificarSenha(senhaAtual, locals.investidor.senhaHash)) {
      return fail(400, { erro: 'Senha atual incorreta.' });
    }
    if (!senhaAceitavel(novaSenha)) {
      return fail(400, {
        erro: 'A nova senha precisa atingir pelo menos o nível "forte": 8+ caracteres e ao menos 4 de 5 requisitos.'
      });
    }
    if (novaSenha !== confirmarSenha) {
      return fail(400, { erro: 'As senhas não coincidem.' });
    }

    await db.investidor.update({
      where: { id: locals.investidor.id },
      data: { senhaHash: hashSenha(novaSenha) }
    });

    return { sucesso: true };
  }
};
