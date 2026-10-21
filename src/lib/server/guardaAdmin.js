import { PERFIS_COM_ACESSO_CADASTRO } from './auth-staff.js';

// Área da equipe (/admin): a sessão é exigida AQUI, na entrada de toda requisição — páginas, ações de formulário
// (?/acao) e endpoints (+server.js). Guardar só no `load` do layout não basta: ações e endpoints não passam por ele.
export const ADMIN_PUBLICO = ['/admin/login', '/admin/cadastro', '/admin/assinatura-retorno', '/admin/logout'];
// qualquer perfil logado (inclusive atendimento) pode usar estas áreas; o resto exige perfil de gestão
export const ADMIN_TODOS_OS_PERFIS = ['/admin/checkin', '/admin/sem-acesso'];

const sob = (caminho, bases) => bases.some((b) => caminho === b || caminho.startsWith(`${b}/`));

/** Decide se a requisição à área da equipe passa; devolve a Response de bloqueio ou null. */
export function bloqueioAdmin(event) {
  const caminho = event.url.pathname;
  if (caminho !== '/admin' && !caminho.startsWith('/admin/')) return null;
  if (caminho === '/admin' || sob(caminho, ADMIN_PUBLICO)) return null; // /admin só redireciona (login ou início)

  const leitura = event.request.method === 'GET' || event.request.method === 'HEAD';
  const redirecionar = (destino) => new Response(null, { status: 303, headers: { location: destino } });

  const funcionario = event.locals.funcionario;
  if (!funcionario) return leitura ? redirecionar('/admin/login') : new Response('Não autorizado.', { status: 401 });

  if (!sob(caminho, ADMIN_TODOS_OS_PERFIS) && !PERFIS_COM_ACESSO_CADASTRO.includes(funcionario.perfil)) {
    return leitura ? redirecionar('/admin/sem-acesso') : new Response('Acesso negado.', { status: 403 });
  }
  return null;
}

