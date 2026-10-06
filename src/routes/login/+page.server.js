import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import {
  SESSION_COOKIE,
  cpfValido,
  criarSessao,
  definirUnidadeNaSessao,
  verificarSenha
} from '$lib/server/auth.js';

export function load({ locals }) {
  // já autenticado: manda direto pro destino certo
  if (locals.investidor) throw redirect(303, '/login/continuar');
}

export const actions = {
  default: async ({ request, cookies }) => {
    const form = await request.formData();
    const cpfBruto = String(form.get('cpf') ?? '');
    const senha = String(form.get('senha') ?? '');

    if (!cpfValido(cpfBruto)) {
      return fail(400, { erro: 'CPF inválido.', cpf: cpfBruto });
    }
    if (!senha) {
      return fail(400, { erro: 'Informe sua senha.', cpf: cpfBruto });
    }

    const cpf = cpfBruto.replace(/\D/g, '');
    const investidor = await db.investidor.findUnique({ where: { cpf } });

    // mesma mensagem pra CPF inexistente ou senha errada — evita confirmar se o CPF existe
    if (!investidor || !verificarSenha(senha, investidor.senhaHash)) {
      return fail(400, { erro: 'CPF ou senha incorretos.', cpf: cpfBruto });
    }

    const { token, expiresAt } = await criarSessao(investidor.id);
    cookies.set(SESSION_COOKIE, token, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      expires: expiresAt
    });

    if (investidor.primeiroAcesso) {
      throw redirect(303, '/primeiro-acesso');
    }

    const vinculos = await db.unidadeInvestidor.findMany({
      where: { investidorId: investidor.id },
      select: { unidadeId: true }
    });

    if (vinculos.length === 1) {
      await definirUnidadeNaSessao(token, vinculos[0].unidadeId);
      throw redirect(303, '/painel');
    }

    // mais de uma unidade vinculada: pede pra escolher
    throw redirect(303, '/login/unidades');
  }
};
