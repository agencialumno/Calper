<script>
  import { clickFora } from './clickFora.js';
  import { formatarCpf } from '$lib/cpf.js';

  let { investidor } = $props();
  let aberto = $state(false);

  const iniciais = $derived(
    investidor.nome
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('')
  );
</script>

<div class="relative" use:clickFora={() => (aberto = false)}>
  <button
    type="button"
    onclick={() => (aberto = !aberto)}
    aria-haspopup="menu"
    aria-expanded={aberto}
    aria-label="Menu do usuário"
    class="flex items-center gap-2 rounded-full p-1 pr-2 hover:bg-gray-50 transition-colors"
  >
    <span
      class="w-9 h-9 rounded-full bg-calper-dark text-white text-sm font-bold flex items-center justify-center"
      >{iniciais}</span
    >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="text-gray-400 hidden sm:block">
      <path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </button>

  {#if aberto}
    <div role="menu" class="absolute right-0 top-full mt-2 w-64 card shadow-lg p-2 z-30">
      <div class="px-3 py-3 border-b border-gray-100 mb-1">
        <div class="text-sm font-bold text-calper-dark truncate">{investidor.nome}</div>
        <div class="text-xs text-gray-500 mt-0.5">CPF {formatarCpf(investidor.cpf)}</div>
      </div>
      <a
        href="/perfil"
        role="menuitem"
        onclick={() => (aberto = false)}
        class="block rounded-xl px-3 py-2.5 text-sm font-semibold text-calper-dark hover:bg-gray-50"
      >
        Meu perfil
      </a>
      <form method="POST" action="/logout">
        <button
          type="submit"
          role="menuitem"
          class="w-full text-left rounded-xl px-3 py-2.5 text-sm font-semibold text-calper-red hover:bg-red-50"
        >
          Sair
        </button>
      </form>
    </div>
  {/if}
</div>
