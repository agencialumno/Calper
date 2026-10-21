import { SESSION_COOKIE, validarSessao } from '$lib/server/auth.js';
import {
  PERFIS_COM_ACESSO_CADASTRO,
  STAFF_SESSION_COOKIE,
  validarSessaoFuncionario
} from '$lib/server/auth-staff.js';

// Área da equipe (/admin): a sessão é exigida AQUI, na entrada de toda requisição — páginas, ações de formulário
// (?/acao) e endpoints (+server.js). Guardar só no `load` do layout não basta: ações e endpoints não passam por ele.
const ADMIN_PUBLICO = ['/admin/login', '/admin/cadastro', '/admin/assinatura-retorno', '/admin/logout'];
// qualquer perfil logado (inclusive atendimento) pode usar estas áreas; o resto exige perfil de gestão
const ADMIN_TODOS_OS_PERFIS = ['/admin/checkin', '/admin/sem-acesso'];

const sob = (caminho, bases) => bases.some((b) => caminho === b || caminho.startsWith(`${b}/`));

/** Decide se a requisição à área da equipe passa; devolve a Response de bloqueio ou null. */
function bloqueioAdmin(event) {
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

  const bloqueio = bloqueioAdmin(event);
  if (bloqueio) return bloqueio;

  // Área da equipe usa manifest próprio (PWA separado, abre em /admin).
  const response = await resolve(event, {
    transformPageChunk: ({ html }) =>
      event.url.pathname.startsWith('/admin')
        ? html.replace('href="/manifest.webmanifest"', 'href="/manifest-equipe.webmanifest"')
        : html
  });

  // Impede o navegador de guardar essas páginas no cache (bfcache) — sem isso,
  // o botão "voltar" reexibiria uma tela antiga (ex: um agendamento já
  // cancelado, ou a confirmação de um check-in) deixando a ação parecer
  // reversível quando na verdade já foi persistida no banco.
  response.headers.set('cache-control', 'no-store, must-revalidate');

  return response;
}