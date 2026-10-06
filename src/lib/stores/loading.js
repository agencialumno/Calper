import { writable } from 'svelte/store';

// Ligado manualmente nos formulários (ex: login) para cobrir o intervalo entre
// o clique e a resposta do servidor — antes de qualquer navegação começar.
export const isBusy = writable(false);

/**
 * Helper pra usar no lugar de `use:enhance` puro quando a ação pode terminar
 * sem navegação (ex: erro de login) — nesses casos o spinner precisa
 * desligar sozinho, já que não existe redirect pra `$navigating` cobrir.
 *
 * Uso: <form method="POST" use:enhance={comLoading}>
 */
export function comLoading() {
  isBusy.set(true);
  return async ({ update }) => {
    await update();
    isBusy.set(false);
  };
}
