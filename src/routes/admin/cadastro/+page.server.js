import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { hashSenha } from '$lib/server/auth.js';
import { STAFF_SESSION_COOKIE, criarSessaoFuncionario } from '$lib/server/auth-staff.js';
import { registrarLog } from '$lib/server/log.js';
import { notificarFuncionarios } from '$lib/server/notificacao.js';
import { emailValido } from '$lib/cpf.js';
import { senhaAceitavel } from '$lib/password.js';

// Cadastro da equipe pela tela de login, com ATIVAÇÃO DIRETA: a conta nasce ativa e já entra logada,
// sem aprovação de um admin e sem código de convite (decisão consciente da Calper).
// Quem se cadastra recebe o perfil "admin" (acesso total, inclusive à tela de logs) — decisão consciente da
// Calper — e os admins existentes são avisados no sino.
export function load({ locals }) {
  if (locals.funcionario) throw redirect(303, '/admin/unidades');
}

export const actions = {
  default: async (event) => {
    const { request, cookies } = event;
    const form = await request.formData();
    const nome = String(form.get('nome') ?? '').trim();
    const email = String(form.get('email') ?? '').trim().toLowerCase();
    const senha = String(form.get('senha') ?? '');
    const confirmar = String(form.get('confirmarSenha') ?? '');
    const valores = { nome, email };

    if (nome.length < 3) return fail(400, { erro: 'Informe seu nome completo.', valores });
    if (!emailValido(email)) return fail(400, { erro: 'Informe um e-mail válido.', valores });
    if (!senhaAceitavel(senha)) {
      return fail(400, {
        erro: 'A senha precisa ter pelo menos 8 caracteres e atingir o nível "forte" (maiúscula, minúscula, número e caractere especial).',
        valores
      });
    }
    if (senha !== confirmar) return fail(400, { erro: 'As senhas não coincidem.', valores });
    if (await db.funcionario.findUnique({ where: { email } })) {
      return fail(400, { erro: 'Já existe uma conta com esse e-mail. Entre com a sua senha.', valores });
    }

    let funcionario;
    try {
      funcionario = await db.funcionario.create({
        data: { nome, email, senhaHash: hashSenha(senha), perfil: 'admin', ativo: true }
      });
    } catch (err) {
      if (err?.code === 'P2002') return fail(400, { erro: 'Já existe uma conta com esse e-mail.', valores });
      throw err;
    }

    await registrarLog({
      event,
      atorTipo: 'funcionario',
      funcionarioId: funcionario.id,
      acao: 'funcionario_cadastrado',
      descricao: `${nome} (${email}) se cadastrou na área da equipe pela tela de login (perfil admin, ativação direta, sem aprovação)`,
      entidadeTipo: 'Funcionario',
      entidadeId: funcionario.id
    });
    await notificarFuncionarios({
      titulo: 'Novo cadastro na equipe',
      mensagem: `${nome} (${email}) criou uma conta de administrador pela tela de login.`,
      link: '/admin/logs',
      perfis: ['admin']
    });

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
