<script>
  let { data } = $props();
</script>

<svelte:head>
  <title>Empreendimentos — Calper</title>
</svelte:head>

<div class="p-5 md:p-8 max-w-4xl">
  <div class="flex items-center justify-between gap-3 mb-6">
    <h1 class="text-xl font-bold text-calper-dark">Empreendimentos</h1>
    <a href="/admin/empreendimentos/nova" class="btn-outline !py-2 text-sm">Novo empreendimento</a>
  </div>

  <div class="flex flex-col gap-3">
    {#each data.empreendimentos as e (e.id)}
      <a
        href="/admin/empreendimentos/{e.id}"
        class="card p-4 md:p-5 hover:border-calper-red hover:shadow-sm transition-shadow"
      >
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div class="text-sm font-bold text-calper-dark">{e.nome}</div>
            <div class="text-xs text-gray-500 mt-0.5">
              {e.totalUnidades} unidade(s) · {e.temBanner ? 'banner cadastrado' : 'sem banner'}
            </div>
          </div>
          <div class="text-sm font-bold text-calper-dark">{e.progresso}%</div>
        </div>
        <div class="h-2 rounded-full bg-gray-100 overflow-hidden mt-3">
          <div class="h-full bg-calper-red" style="width: {e.progresso}%"></div>
        </div>
      </a>
    {:else}
      <p class="text-sm text-gray-400">Nenhum empreendimento cadastrado.</p>
    {/each}
  </div>
</div>
