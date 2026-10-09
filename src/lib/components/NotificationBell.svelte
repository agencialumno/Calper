<script>
  import { invalidateAll } from '$app/navigation';

  let { notificacoes } = $props();
  const id = $props.id();
  const popoverId = `notificacoes-${id}`;
  let botaoEl = $state(null);
  let popoverEl = $state(null);

  function formatarData(iso) {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // O Popover API cuida de abrir/fechar (clique fora, Esc) e de renderizar na
  // top layer — assim o painel nunca é cortado por um container com scroll.
  // Só falta ancorar o painel no botão a cada abertura.
  function posicionar(e) {
    if (e.newState !== 'open' || !botaoEl || !popoverEl) return;
    const rect = botaoEl.getBoundingClientRect();
    popoverEl.style.top = `${rect.bottom + 8}px`;
    popoverEl.style.right = `${Math.max(8, window.innerWidth - rect.right)}px`;
  }

  async function marcarLida(id) {
    try {
      await fetch('/api/notificacoes/marcar-lida', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id })
      });
    } finally {
      await invalidateAll();
    }
  }

  async function marcarTodasLidas() {
    try {
      await fetch('/api/notificacoes/marcar-lida', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ todas: true })
      });
    } finally {
      await invalidateAll();
    }
  }

</script>

<button
  bind:this={botaoEl}
  type="button"
  popovertarget={popoverId}
  class="relative w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-500/15 transition-colors shrink-0"
  aria-label="Notificações"
>
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M13.73 21a2 2 0 01-3.46 0" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
  {#if notificacoes.naoLidas > 0}
    <span
      class="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-calper-red text-white text-[10px] font-bold flex items-center justify-center"
    >
      {notificacoes.naoLidas > 9 ? '9+' : notificacoes.naoLidas}
    </span>
  {/if}
</button>

<div
  bind:this={popoverEl}
  id={popoverId}
  popover="auto"
  onbeforetoggle={posicionar}
  class="notificacoes-popover w-[340px] max-w-[calc(100vw-1rem)] bg-white text-calper-dark rounded-2xl shadow-xl border border-gray-100 overflow-hidden p-0 m-0"
>
  <div class="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
    <span class="text-base font-bold text-calper-dark">Notificações</span>
    {#if notificacoes.naoLidas > 0}
      <button type="button" onclick={marcarTodasLidas} class="text-xs font-semibold text-calper-red"
        >Marcar todas como lidas</button
      >
    {/if}
  </div>
  <div class="max-h-[60vh] overflow-y-auto">
    {#if notificacoes.itens.length === 0}
      <div class="px-5 py-10 text-center text-sm text-gray-500">Nenhuma notificação ainda.</div>
    {:else}
      {#each notificacoes.itens as n (n.id)}
        <a
          href={n.link ?? '#'}
          onclick={() => !n.lida && marcarLida(n.id)}
          class="block px-5 py-4 border-b border-gray-50 last:border-b-0 hover:bg-gray-50 transition-colors {!n.lida
            ? 'bg-red-50/60'
            : ''}"
        >
          <div class="flex items-start gap-2.5">
            {#if !n.lida}
              <span class="w-2 h-2 rounded-full bg-calper-red mt-1.5 shrink-0"></span>
            {/if}
            <div class="min-w-0">
              <div class="text-sm font-bold text-calper-dark">{n.titulo}</div>
              <div class="text-sm text-gray-600 mt-0.5 leading-snug">{n.mensagem}</div>
              <div class="text-xs text-gray-400 mt-1.5">{formatarData(n.createdAt)}</div>
            </div>
          </div>
        </a>
      {/each}
    {/if}
  </div>
</div>

<style>
  /* o UA stylesheet centraliza o popover (inset:0; margin:auto) — o JS sobrescreve top/right */
  .notificacoes-popover {
    inset: auto;
    position: fixed;
  }
</style>
