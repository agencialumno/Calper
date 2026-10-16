// Página de retorno do DocuSign (returnUrl) quando a cerimônia roda em iframe dentro do admin.
// Não exige login e não processa nada: só avisa a janela de fora para ir à tela que confere o
// envelope de verdade (assinatura-concluida), já com a sessão do atendente.
export function load({ url }) {
  const destino = url.searchParams.get('destino') ?? '';
  // só caminhos internos do fluxo de entrega (evita redirecionar para outro site)
  const valido = /^\/admin\/entrega-chaves\/[\w-]+\/assinatura-concluida\?[\w=&%-]*$/.test(destino);
  return { destino: valido ? destino : '/admin/entrega-chaves' };
}
