import { permissaoNoCaminho } from '../perfis.js';

// Área da equipe (/admin): a sessão e o PERFIL são exigidos AQUI, na entrada de toda requisição — páginas, ações de
// formulário (?/acao) e endpoints (+server.js). Guardar só no `load` do layout não basta: ações e endpoints não
// passam por ele. As regras por perfil (admin / supervisor / colaborador) estão em src/lib/perfis.js.
export const ADMIN_PUBLICO = ['/admin/login', '/admin/cadastro', '/admin/assinatura-retorno', '/admin/logout'];

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

  // a tela de aviso é de qualquer perfil logado
  if (caminho === '/admin/sem-acesso') return null;

  const permissao = permissaoNoCaminho(funcionario.perfil, event.request.method, caminho);
  if (permissao === 'sem-acesso') {
    return leitura ? redirecionar('/admin/sem-acesso') : new Response('Acesso negado.', { status: 403 });
  }
  if (permissao === 'somente-leitura') return new Response('Seu perfil é somente leitura: não é possível alterar dados.', { status: 403 });
  return null;
}
