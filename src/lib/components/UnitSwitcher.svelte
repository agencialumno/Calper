<script>
  import { clickFora } from './clickFora.js';

  let { unidade, unidades } = $props();
  let aberto = $state(false);
  const podeTrocar = $derived(unidades.length > 1);
</script>

<div class="relative min-w-0" use:clickFora={() => (aberto = false)}>
  <button
    type="button"
    disabled={!podeTrocar}
    onclick={() => (aberto = !aberto)}
    aria-haspopup="listbox"
    aria-expanded={aberto}
    class="flex items-center gap-2 text-left rounded-xl px-2.5 py-1.5 -mx-2.5 max-w-full enabled:hover:bg-gray-50 transition-colors"
  >
    <span class="min-w-0">
      <span class="block text-[11px] font-semibold text-gray-400 tracking-wide uppercase">Unidade</span>
      {#if unidade}
        <span class="block text-base md:text-lg font-extrabold text-calper-dark truncate leading-tight">
          {unidade.numero} — Bloco {unidade.bloco}
        </span>
      {/if}
    </span>
    {#if podeTrocar}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="shrink-0 text-gray-400">
        <path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    {/if}
  </button>

  {#if aberto}
    <div
      role="listbox"
      class="absolute left-0 top-full mt-2 w-72 max-w-[calc(100vw-2rem)] card shadow-lg p-2 z-30"
    >
      <div class="px-3 pt-2 pb-1.5 text-[11px] font-semibold text-gray-400 tracking-wide uppercase">
        Trocar de unidade
      </div>
      {#each unidades as u (u.id)}
        {@const atual = u.id === unidade?.id}
        <form method="POST" action="/trocar-unidade">
          <input type="hidden" name="unidadeId" value={u.id} />
          <button
            type="submit"
            role="option"
            aria-selected={atual}
            class="w-full flex items-center justify-between gap-3 text-left rounded-xl px-3 py-2.5 hover:bg-gray-50"
            class:bg-gray-50={atual}
          >
            <span class="min-w-0">
              <span class="block text-sm font-bold text-calper-dark truncate">{u.numero} — Bloco {u.bloco}</span>
              <span class="block text-xs text-gray-500 truncate">{u.empreendimento}</span>
            </span>
            {#if atual}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dd0417" stroke-width="3" class="shrink-0">
                <path d="M5 12l5 5 9-10" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            {/if}
          </button>
        </form>
      {/each}
    </div>
  {/if}
</div>
