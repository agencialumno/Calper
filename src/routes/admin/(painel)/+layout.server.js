import { redirect } from '@sveltejs/kit';
import { PERFIS_COM_ACESSO_CADASTRO } from '$lib/server/auth-staff.js';

export function load({ locals }) {
  if (!locals.funcionario) throw redirect(303, '/admin/login');

  if (!PERFIS_COM_ACESSO_CADASTRO.includes(locals.funcionario.perfil)) {
    // perfil de atendimento ainda não tem tela própria nesse módulo —
    // o check-in (onde ele atua) entra em um módulo futuro.
    throw redirect(303, '/admin/sem-acesso');
  }

  return {
    funcionario: {
      nome: locals.funcionario.nome,
      perfil: locals.funcionario.perfil
    }
  };
}
