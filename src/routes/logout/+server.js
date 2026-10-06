import { redirect } from '@sveltejs/kit';
import { SESSION_COOKIE, encerrarSessao } from '$lib/server/auth.js';

export async function POST({ cookies, locals }) {
  if (locals.sessionToken) await encerrarSessao(locals.sessionToken);
  cookies.delete(SESSION_COOKIE, { path: '/' });
  throw redirect(303, '/login');
}
