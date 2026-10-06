import { redirect } from '@sveltejs/kit';
import { STAFF_SESSION_COOKIE, encerrarSessaoFuncionario } from '$lib/server/auth-staff.js';

export async function POST({ cookies, locals }) {
  if (locals.staffSessionToken) await encerrarSessaoFuncionario(locals.staffSessionToken);
  cookies.delete(STAFF_SESSION_COOKIE, { path: '/' });
  throw redirect(303, '/admin/login');
}
