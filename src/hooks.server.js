import { SESSION_COOKIE, validarSessao } from '$lib/server/auth.js';
import { STAFF_SESSION_COOKIE, validarSessaoFuncionario } from '$lib/server/auth-staff.js';

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
  const token = event.cookies.get(SESSION_COOKIE);
  const sessao = await validarSessao(token);

  event.locals.investidor = sessao?.investidor ?? null;
  event.locals.unidadeId = sessao?.unidadeId ?? null;
  event.locals.sessionToken = sessao ? token : null;

  const staffToken = event.cookies.get(STAFF_SESSION_COOKIE);
  const sessaoStaff = await validarSessaoFuncionario(staffToken);

  event.locals.funcionario = sessaoStaff?.funcionario ?? null;
  event.locals.staffSessionToken = sessaoStaff ? staffToken : null;

  const response = await resolve(event);

  // Impede o navegador de guardar essas páginas no cache (bfcache) — sem isso,
  // o botão "voltar" reexibiria uma tela antiga (ex: um agendamento já
  // cancelado, ou a confirmação de um check-in) deixando a ação parecer
  // reversível quando na verdade já foi persistida no banco.
  response.headers.set('cache-control', 'no-store, must-revalidate');

  return response;
}