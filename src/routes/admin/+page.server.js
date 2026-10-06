import { redirect } from '@sveltejs/kit';

export function load({ locals }) {
  if (!locals.funcionario) throw redirect(303, '/admin/login');
  throw redirect(303, locals.funcionario.perfil === 'atendimento' ? '/admin/checkin' : '/admin/unidades');
}