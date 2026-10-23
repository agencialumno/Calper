import { redirect } from '@sveltejs/kit';

export function load({ locals }) {
  if (!locals.funcionario) throw redirect(303, '/admin/login');
  // todos os perfis (admin, supervisor, colaborador) começam no dashboard
  throw redirect(303, '/admin/dashboard');
}
