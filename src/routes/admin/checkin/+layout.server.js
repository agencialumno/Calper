import { redirect } from '@sveltejs/kit';

// Diferente de (painel), aqui qualquer perfil ativo (inclusive atendimento) pode entrar.
export function load({ locals }) {
  if (!locals.funcionario) throw redirect(303, '/admin/login');

  return {
    funcionario: { nome: locals.funcionario.nome, perfil: locals.funcionario.perfil }
  };
}