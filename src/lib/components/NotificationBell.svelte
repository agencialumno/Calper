<script>
  import { invalidateAll } from '$app/navigation';

  let { notificacoes } = $props();
  let aberto = $state(false);
  let botaoEl = $state(null);
  let posicao = $state({ top: 0, right: 0 });

  function formatarData(iso) {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function alternar() {
    if (!aberto && botaoEl) {
      // posição fixa (não absolute) — assim o dropdown nunca é cortado por um
      // container com scroll, como a barra lateral do admin
      const rect = botaoEl.getBoundingClientRect();
      posicao = { top: rect.bottom + 8, right: window.innerWidth - rect.right };
    }
    aberto = !aberto;
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

  function aoClicarFora(node) {
    function aoClicar(e) {
      if (!node.contains(e.target)) aberto = false;
    }
    document.addEventListener('click', aoClicar, true);
    return { destroy: () => document.removeEventListener('click', aoClicar, true) };
  }
</script>

<div use:aoClicarFora>
  <button
    bind:this={botaoEl}
    type="button"
    onclick={alternar}
    class="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors shrink-0"
    aria-label="Notificações"
  >
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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

  {#if aberto}
    <div
      style="position: fixed; top: {posicao.top}px; right: {posicao.right}px;"
      class="w-[320px] max-w-[90vw] bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50"
    >
      <div class="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span class="text-sm font-bold text-calper-dark">Notificações</span>
        {#if notificacoes.naoLidas > 0}
          <button type="button" onclick={marcarTodasLidas} class="text-xs font-semibold text-calper-red"
            >Marcar todas como lidas</button
          >
        {/if}
      </div>
      <div class="max-h-[360px] overflow-y-auto">
        {#if notificacoes.itens.length === 0}
          <div class="px-4 py-8 text-center text-sm text-gray-400">Nenhuma notificação ainda.</div>
        {:else}
          {#each notificacoes.itens as n (n.id)}
            <a
              href={n.link ?? '#'}
              onclick={() => !n.lida && marcarLida(n.id)}
              class="block px-4 py-3 border-b border-gray-50 last:border-b-0 hover:bg-gray-50 transition-colors {!n.lida
                ? 'bg-red-50/60'
                : ''}"
            >
              <div class="flex items-start gap-2">
                {#if !n.lida}
                  <span class="w-1.5 h-1.5 rounded-full bg-calper-red mt-1.5 shrink-0"></span>
                {/if}
                <div class="min-w-0">
                  <div class="text-[13px] font-bold text-calper-dark">{n.titulo}</div>
                  <div class="text-xs text-gray-500 mt-0.5">{n.mensagem}</div>
                  <div class="text-[11px] text-gray-400 mt-1">{formatarData(n.createdAt)}</div>
                </div>
              </div>
            </a>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</div>