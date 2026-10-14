import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { verificarSenha } from '$lib/server/auth.js';
import { STAFF_SESSION_COOKIE, criarSessaoFuncionario } from '$lib/server/auth-staff.js';
import { registrarLog, rotuloFuncionario } from '$lib/server/log.js';

export function load({ locals }) {
  if (locals.funcionario) throw redirect(303, '/admin/unidades');
}

export const actions = {
  default: async (event) => {
    const { request, cookies } = event;
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
      await registrarLog({
        event,
        atorTipo: 'funcionario',
        funcionarioId: funcionario?.id,
        acao: 'login_falhou',
        descricao: funcionario
          ? `Login falhou para ${rotuloFuncionario(funcionario)} — ${funcionario.ativo ? 'senha incorreta' : 'usuário inativo'}`
          : `Tentativa de login da equipe com e-mail não cadastrado: ${email}`,
        entidadeTipo: funcionario ? 'Funcionario' : null,
        entidadeId: funcionario?.id
      });
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

    await registrarLog({
      event,
      atorTipo: 'funcionario',
      funcionarioId: funcionario.id,
      acao: 'login',
      descricao: `${rotuloFuncionario(funcionario)} fez login na área da equipe`,
      entidadeTipo: 'Funcionario',
      entidadeId: funcionario.id
    });

    throw redirect(303, '/admin/unidades');
  }
};
