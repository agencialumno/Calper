import { redirect } from '@sveltejs/kit';
import { SESSION_COOKIE, encerrarSessao } from '$lib/server/auth.js';
import { registrarLog, rotuloInvestidor } from '$lib/server/log.js';

export async function POST(event) {
  const { cookies, locals } = event;
  if (locals.investidor) {
    await registrarLog({
      event,
      atorTipo: 'investidor',
      acao: 'logout',
      descricao: `${rotuloInvestidor(locals.investidor)} saiu do sistema`,
      entidadeTipo: 'Investidor',
      entidadeId: locals.investidor.id
    });
  }
  if (locals.sessionToken) await encerrarSessao(locals.sessionToken);
  cookies.delete(SESSION_COOKIE, { path: '/' });
  throw redirect(303, '/login');
}
