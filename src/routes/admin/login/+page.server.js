import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { verificarSenha } from '$lib/server/auth.js';
import { STAFF_SESSION_COOKIE, criarSessaoFuncionario } from '$lib/server/auth-staff.js';

export function load({ locals }) {
  if (locals.funcionario) throw redirect(303, '/admin/unidades');
}

export const actions = {
  default: async ({ request, cookies }) => {
    const form = await request.formData();
    const email = String(form.get('email') ?? '')
      .trim()
      .toLowerCase();
    const senha = String(form.get('senha') ?? '');

    if (!email || !senha) {
      return fail(400, { erro: 'Informe e-mail e senha.', email });
    }

    const funcionario = await db.funcionario.findUnique({ where: { email } });

    if (!funcionario || !funcionario.ativo || !verificarSenha(senha, funcionario.senhaHash)) {
      return fail(400, { erro: 'E-mail ou senha incorretos.', email });
    }

    const { token, expiresAt } = await criarSessaoFuncionario(funcionario.id);
    cookies.set(STAFF_SESSION_COOKIE, token, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      expires: expiresAt
    });

    throw redirect(303, '/admin/unidades');
  }
};
