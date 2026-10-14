import { redirect } from '@sveltejs/kit';
import { STAFF_SESSION_COOKIE, encerrarSessaoFuncionario } from '$lib/server/auth-staff.js';
import { registrarLog, rotuloFuncionario } from '$lib/server/log.js';

export async function POST(event) {
  const { cookies, locals } = event;
  if (locals.funcionario) {
    await registrarLog({
      event,
      atorTipo: 'funcionario',
      acao: 'logout',
      descricao: `${rotuloFuncionario(locals.funcionario)} saiu da área da equipe`,
      entidadeTipo: 'Funcionario',
      entidadeId: locals.funcionario.id
    });
  }
  if (locals.staffSessionToken) await encerrarSessaoFuncionario(locals.staffSessionToken);
  cookies.delete(STAFF_SESSION_COOKIE, { path: '/' });
  throw redirect(303, '/admin/login');
}
