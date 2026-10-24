import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { hashSenha } from '$lib/server/auth.js';
import { registrarLog } from '$lib/server/log.js';
import { notificarFuncionarios } from '$lib/server/notificacao.js';
import { emailValido } from '$lib/cpf.js';
import { senhaAceitavel } from '$lib/password.js';

// Pedido de cadastro da equipe pela tela de login: a conta nasce INATIVA e sem login automático; um admin ativa
// (e define o perfil) em /admin/usuarios. Os admins são avisados no sino.
// Quem se cadastra recebe o perfil de MENOR privilégio, "colaborador" (somente leitura + atendimento presencial).
// Antes de existirem perfis, todo cadastro virava admin; agora um admin promove a pessoa em /admin/usuarios, e os
// admins existentes são avisados no sino.
export function load({ locals }) {
  if (locals.funcionario) throw redirect(303, '/admin/unidades');
}

export const actions = {
  default: async (event) => {
    const { request } = event;
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
        data: { nome, email, senhaHash: hashSenha(senha), perfil: 'colaborador', ativo: false }
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
      descricao: `${nome} (${email}) se cadastrou na área da equipe pela tela de login (conta INATIVA, perfil colaborador: só entra depois que um admin ativar em Usuários)`,
      entidadeTipo: 'Funcionario',
      entidadeId: funcionario.id
    });
    await notificarFuncionarios({
      titulo: 'Pedido de acesso da equipe',
      mensagem: `${nome} (${email}) pediu acesso pela tela de login. A conta está inativa: ative e defina o perfil em Usuários.`,
      link: '/admin/usuarios',
      perfis: ['admin']
    });

    // sem login automático: a conta só funciona depois que um admin a ativa em /admin/usuarios
    return { pendente: true, email };
  }
};
