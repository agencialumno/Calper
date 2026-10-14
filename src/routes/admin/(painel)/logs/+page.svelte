<script>
  let { data } = $props();

  function formatarDataHora(iso) {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  function linkPagina(n) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(data.filtros)) if (v) p.set(k, v);
    p.set('pagina', String(n));
    return `?${p}`;
  }

  const corAcao = (acao) =>
    acao.includes('falhou')
      ? 'bg-red-50 text-calper-red'
      : acao.startsWith('login') || acao === 'logout'
        ? 'bg-gray-100 text-gray-500'
        : 'bg-blue-50 text-blue-600';
</script>

<svelte:head>
  <title>Logs de auditoria — Calper</title>
</svelte:head>

<div class="p-5 md:p-8 max-w-6xl">
  <h1 class="text-xl font-bold text-calper-dark">Logs de auditoria</h1>
  <p class="text-sm text-gray-500 mt-0.5 mb-5">{data.total} registro(s)</p>

  <form method="GET" class="card p-4 grid grid-cols-2 md:grid-cols-6 gap-3 mb-5 items-end">
    <div class="col-span-2">
      <label for="q" class="block text-xs font-semibold text-gray-500 mb-1">Buscar (nome, CPF, e-mail, texto)</label>
      <input id="q" name="q" value={data.filtros.q} class="input !py-2 text-sm" />
    </div>
    <div>
      <label for="ator" class="block text-xs font-semibold text-gray-500 mb-1">Ator</label>
      <select id="ator" name="ator" class="input !py-2 text-sm">
        <option value="">todos</option>
        <option value="investidor" selected={data.filtros.ator === 'investidor'}>Investidor</option>
        <option value="funcionario" selected={data.filtros.ator === 'funcionario'}>Equipe</option>
      </select>
    </div>
    <div>
      <label for="acao" class="block text-xs font-semibold text-gray-500 mb-1">Ação</label>
      <select id="acao" name="acao" class="input !py-2 text-sm">
        <option value="">todas</option>
        {#each data.acoes as a}
          <option value={a} selected={data.filtros.acao === a}>{a}</option>
        {/each}
      </select>
    </div>
    <div>
      <label for="de" class="block text-xs font-semibold text-gray-500 mb-1">De</label>
      <input id="de" name="de" type="date" value={data.filtros.de} class="input !py-2 text-sm" />
    </div>
    <div>
      <label for="ate" class="block text-xs font-semibold text-gray-500 mb-1">Até</label>
      <input id="ate" name="ate" type="date" value={data.filtros.ate} class="input !py-2 text-sm" />
    </div>
    <button type="submit" class="btn-primary !py-2 text-sm col-span-2 md:col-span-1">Filtrar</button>
    <a href="/admin/logs" class="text-xs font-semibold text-gray-500 text-center md:text-left">Limpar</a>
  </form>

  <div class="card overflow-x-auto">
    {#each data.logs as l (l.id)}
      <div class="flex flex-col md:flex-row md:items-start gap-1.5 md:gap-4 p-4 border-t border-gray-100 first:border-t-0">
        <div class="text-xs text-gray-500 md:w-40 shrink-0">{formatarDataHora(l.createdAt)}</div>
        <div class="md:w-44 shrink-0">
          <div class="text-sm font-semibold text-calper-dark">{l.ator ?? '—'}</div>
          <div class="text-[11px] text-gray-400">{l.atorTipo === 'investidor' ? 'Investidor' : 'Equipe'}</div>
        </div>
        <div class="min-w-0 flex-1">
          <span class="text-[11px] font-bold px-2 py-0.5 rounded-full {corAcao(l.acao)}">{l.acao}</span>
          <div class="text-sm text-calper-dark mt-1">{l.descricao}</div>
        </div>
        <div class="text-[11px] text-gray-400 md:w-28 shrink-0 md:text-right">{l.ip ?? ''}</div>
      </div>
    {:else}
      <p class="text-sm text-gray-400 p-6">Nenhum registro encontrado.</p>
    {/each}
  </div>

  {#if data.totalPaginas > 1}
    <div class="flex items-center justify-between mt-4 text-sm">
      {#if data.pagina > 1}
        <a href={linkPagina(data.pagina - 1)} class="font-semibold text-calper-red">← Mais recentes</a>
      {:else}<span></span>{/if}
      <span class="text-gray-500">Página {data.pagina} de {data.totalPaginas}</span>
      {#if data.pagina < data.totalPaginas}
        <a href={linkPagina(data.pagina + 1)} class="font-semibold text-calper-red">Mais antigos →</a>
      {:else}<span></span>{/if}
    </div>
  {/if}
</div>
