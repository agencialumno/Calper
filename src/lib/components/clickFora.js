/** Svelte action: chama `fn` quando o clique acontece fora do elemento. */
export function clickFora(node, fn) {
  const aoClicar = (e) => {
    if (!node.contains(e.target)) fn();
  };
  document.addEventListener('click', aoClicar, true);
  return { destroy: () => document.removeEventListener('click', aoClicar, true) };
}
