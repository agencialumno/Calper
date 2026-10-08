<script>
  let { data } = $props();

  const statusLabel = {
    regularizado: { texto: 'Regularizado', bg: 'bg-green-50', fg: 'text-green-700' },
    troca_titularidade: { texto: 'Troca de titularidade', bg: 'bg-amber-50', fg: 'text-amber-700' },
    distrato: { texto: 'Distrato', bg: 'bg-red-50', fg: 'text-red-700' }
  };
</script>

<svelte:head>
  <title>Unidades — Calper</title>
</svelte:head>

<div class="p-5 md:p-8 max-w-6xl">
  <!-- no mobile, as ações ficam em botões logo no topo, acima do título -->
  <div class="flex gap-2.5 mb-4 md:hidden">
    <a href="/admin/unidades/importar" class="btn-outline text-sm !py-2.5 flex-1 text-center"
      >Importar planilha</a
    >
    <a href="/admin/unidades/nova" class="btn-primary text-sm !py-2.5 flex-1 text-center">+ Nova unidade</a>
  </div>

  <div class="flex items-center justify-between flex-wrap gap-4 mb-5 md:mb-7">
    <div>
      <h1 class="text-xl font-bold text-calper-dark">Unidades</h1>
      <p class="text-sm text-gray-500 mt-0.5">{data.total} unidades cadastradas</p>
    </div>
    <div class="hidden md:flex gap-2.5">
      <a href="/admin/unidades/importar" class="btn-outline text-sm !py-2.5">Importar planilha</a>
      <a href="/admin/unidades/nova" class="btn-primary text-sm !py-2.5">+ Nova unidade</a>
    </div>
  </div>

  <form method="GET" class="mb-5">
    <input
      type="text"
      name="q"
      value={data.q}
      placeholder="Buscar por unidade, bloco ou empreendimento..."
      class="input max-w-md"
    />
  </form>

  {#if data.unidades.length === 0}
    <div class="card p-10 text-center text-gray-400 text-sm">Nenhuma unidade encontrada.</div>
  {:else}
    <!-- mobile: cards -->
    <div class="flex flex-col gap-2.5 md:hidden">
      {#each data.unidades as u (u.id)}
        <a href={`/admin/unidades/${u.id}`} class="card p-4 flex flex-col gap-2 active:scale-[0.98] transition-transform">
          <div class="flex items-center justify-between gap-3">
            <div class="font-bold text-calper-dark text-[15px]">
              {u.numero} — Bloco {u.bloco}
            </div>
            <span
              class="text-xs font-bold px-2.5 py-1 rounded-full shrink-0 {statusLabel[u.status]?.bg ??
                'bg-gray-100'} {statusLabel[u.status]?.fg ?? 'text-gray-600'}"
            >
              {statusLabel[u.status]?.texto ?? u.status}
            </span>
          </div>
          <div class="text-xs text-gray-500">{u.empreendimento}</div>
          <div class="text-xs text-gray-600">
            {u.investidores.length ? u.investidores.join(', ') : 'sem investidor vinculado'}
          </div>
        </a>
      {/each}
    </div>

    <!-- desktop: tabela -->
    <div class="card overflow-hidden hidden md:block">
      <table class="w-full border-collapse text-sm">
        <thead>
          <tr class="text-left text-[11.5px] uppercase tracking-wide text-gray-400">
            <th class="px-4 py-3 font-bold">Unidade</th>
            <th class="px-4 py-3 font-bold">Empreendimento</th>
            <th class="px-4 py-3 font-bold">Investidores</th>
            <th class="px-4 py-3 font-bold">Status</th>
          </tr>
        </thead>
        <tbody>
          {#each data.unidades as u (u.id)}
            <tr class="border-t border-gray-100 hover:bg-gray-50">
              <td class="px-4 py-3.5">
                <a href={`/admin/unidades/${u.id}`} class="font-bold text-calper-dark hover:text-calper-red">
                  {u.numero} — Bloco {u.bloco}
                </a>
              </td>
              <td class="px-4 py-3.5 text-gray-600">{u.empreendimento}</td>
              <td class="px-4 py-3.5 text-gray-600">
                {u.investidores.length ? u.investidores.join(', ') : '—'}
              </td>
              <td class="px-4 py-3.5">
                <span
                  class="text-xs font-bold px-2.5 py-1 rounded-full {statusLabel[u.status]?.bg ??
                    'bg-gray-100'} {statusLabel[u.status]?.fg ?? 'text-gray-600'}"
                >
                  {statusLabel[u.status]?.texto ?? u.status}
                </span>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>