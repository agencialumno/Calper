<script>
  let { data } = $props();

  function formatarDataHora(iso) {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
</script>

<svelte:head>
  <title>Lista de presença — Calper</title>
</svelte:head>

<div class="p-5 md:p-8 max-w-5xl">
  <a href="/admin/entrega-chaves" class="text-sm text-gray-500 hover:text-calper-dark">← Entrega de chaves</a>
  <h1 class="text-xl font-bold text-calper-dark mt-3">Lista de presença</h1>
  <p class="text-sm text-gray-500 mt-0.5 mb-5">Quem compareceu na entrega de chaves — {data.presencas.length} registro(s)</p>

  <form method="GET" class="card p-4 grid grid-cols-2 md:grid-cols-5 gap-3 mb-5 items-end">
    <div class="col-span-2">
      <label for="q" class="block text-xs font-semibold text-gray-500 mb-1">Buscar (nome, bloco, unidade)</label>
      <input id="q" name="q" value={data.filtros.q} class="input !py-2 text-sm" />
    </div>
    <div>
      <label for="de" class="block text-xs font-semibold text-gray-500 mb-1">De</label>
      <input id="de" name="de" type="date" value={data.filtros.de} class="input !py-2 text-sm" />
    </div>
    <div>
      <label for="ate" class="block text-xs font-semibold text-gray-500 mb-1">Até</label>
      <input id="ate" name="ate" type="date" value={data.filtros.ate} class="input !py-2 text-sm" />
    </div>
    <div class="flex items-center gap-3">
      <button type="submit" class="btn-primary !py-2 text-sm flex-1">Filtrar</button>
      <a href="/admin/presenca" class="text-xs font-semibold text-gray-500">Limpar</a>
    </div>
  </form>

  <div class="flex justify-end mb-3">
    <a href={data.exportarHref} class="text-sm font-bold text-calper-red">Exportar CSV</a>
  </div>

  <div class="card overflow-x-auto">
    {#each data.presencas as p (p.id)}
      <div class="flex flex-col md:flex-row md:items-center gap-1.5 md:gap-4 p-4 border-t border-gray-100 first:border-t-0">
        <div class="text-xs text-gray-500 md:w-40 shrink-0">{formatarDataHora(p.createdAt)}</div>
        <div class="text-sm font-semibold text-calper-dark flex-1 min-w-0">{p.nome}</div>
        <div class="text-xs text-gray-600 md:w-40 shrink-0">{p.vinculo}</div>
        <a href="/admin/unidades/{p.unidadeId}" class="text-sm font-bold text-calper-red md:w-36 shrink-0">{p.unidade}</a>
      </div>
    {:else}
      <p class="text-sm text-gray-400 p-6">Nenhuma presença registrada no período.</p>
    {/each}
  </div>
</div>
