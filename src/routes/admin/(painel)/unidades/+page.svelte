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

<div class="p-8 max-w-6xl">
  <div class="flex items-center justify-between flex-wrap gap-4 mb-7">
    <div>
      <h1 class="text-xl font-bold text-calper-dark">Unidades</h1>
      <p class="text-sm text-gray-500 mt-0.5">{data.total} unidades cadastradas</p>
    </div>
    <div class="flex gap-2.5">
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

  <div class="card overflow-hidden">
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
        {:else}
          <tr>
            <td colspan="4" class="px-4 py-10 text-center text-gray-400 text-sm">
              Nenhuma unidade encontrada.
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
