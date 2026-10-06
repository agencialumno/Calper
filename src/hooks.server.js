import { SESSION_COOKIE, validarSessao } from '$lib/server/auth.js';

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
  const token = event.cookies.get(SESSION_COOKIE);
  const sessao = await validarSessao(token);

  event.locals.investidor = sessao?.investidor ?? null;
  event.locals.unidadeId = sessao?.unidadeId ?? null;
  event.locals.sessionToken = sessao ? token : null;

  return resolve(event);
}
