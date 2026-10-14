<script>
  let { data } = $props();

  const abreviacao = {
    educacaoFuncionarios: 'Educação',
    organizacaoLimpeza: 'Limpeza',
    expectativasAndamento: 'Andamento',
    clarezaInformacoes: 'Clareza',
    acabamentoObra: 'Acabamento'
  };

  function corNota(pontos) {
    if (pontos >= 4) return 'bg-green-50 text-green-700';
    if (pontos === 3) return 'bg-amber-50 text-amber-700';
    return 'bg-red-50 text-calper-red';
  }

  function formatarData(iso) {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function linkPagina(n) {
    const p = new URLSearchParams();
    if (data.filtros.empreendimento) p.set('empreendimento', data.filtros.empreendimento);
    if (data.filtros.de) p.set('de', data.filtros.de);
    if (data.filtros.ate) p.set('ate', data.filtros.ate);
    if (data.filtros.soNaoIndicaria) p.set('naoIndicaria', '1');
    p.set('pagina', String(n));
    return `?${p}`;
  }
</script>

<svelte:head>
  <title>Questionários de encerramento — Calper</title>
</svelte:head>

<div class="p-5 md:p-8 max-w-6xl">
  <h1 class="text-xl font-bold text-calper-dark">Questionários de encerramento</h1>
  <p class="text-sm text-gray-500 mt-0.5 mb-5">Respostas enviadas pelos investidores após cada evento</p>

  <!-- resumo do conjunto filtrado -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
    <div class="card p-4">
      <div class="text-xs text-gray-400 font-semibold">Respostas</div>
      <div class="text-2xl font-extrabold text-calper-dark">{data.resumo.total}</div>
    </div>
    <div class="card p-4">
      <div class="text-xs text-gray-400 font-semibold">Indicaria a Calper</div>
      <div class="text-2xl font-extrabold text-calper-dark">
        {data.resumo.indicaria === null ? '—' : `${data.resumo.indicaria}%`}
      </div>
    </div>
    <div class="card p-4">
      <div class="text-xs text-gray-400 font-semibold">Atendido no horário</div>
      <div class="text-2xl font-extrabold text-calper-dark">
        {data.resumo.noHorario === null ? '—' : `${data.resumo.noHorario}%`}
      </div>
    </div>
    <div class="card p-4 col-span-2 md:col-span-1">
      <div class="text-xs text-gray-400 font-semibold mb-1">Nota média (1–5)</div>
      <div class="flex flex-col gap-0.5 text-xs text-calper-dark">
        {#each data.resumo.medias as m (m.campo)}
          <div class="flex justify-between gap-2">
            <span class="text-gray-500">{abreviacao[m.campo]}</span>
            <strong>{m.media ?? '—'}</strong>
          </div>
        {/each}
      </div>
    </div>
  </div>

  <form method="GET" class="card p-4 grid grid-cols-2 md:grid-cols-5 gap-3 mb-5 items-end">
    <div class="col-span-2 md:col-span-1">
      <label for="empreendimento" class="block text-xs font-semibold text-gray-500 mb-1">Empreendimento</label>
      <select id="empreendimento" name="empreendimento" class="input !py-2 text-sm">
        <option value="">todos</option>
        {#each data.empreendimentos as e (e.id)}
          <option value={e.id} selected={data.filtros.empreendimento === e.id}>{e.nome}</option>
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
    <label class="flex items-center gap-2 text-sm text-calper-dark pb-2">
      <input type="checkbox" name="naoIndicaria" value="1" checked={data.filtros.soNaoIndicaria} />
      Só "não indicaria"
    </label>
    <div class="flex items-center gap-3 col-span-2 md:col-span-1">
      <button type="submit" class="btn-primary !py-2 text-sm flex-1">Filtrar</button>
      <a href="/admin/questionarios" class="text-xs font-semibold text-gray-500">Limpar</a>
    </div>
  </form>

  <div class="flex flex-col gap-3">
    {#each data.respostas as r (r.id)}
      <a
        href="/admin/questionarios/{r.id}"
        class="card p-4 md:p-5 hover:border-calper-red hover:shadow-sm transition-shadow"
      >
        <div class="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div class="text-sm font-bold text-calper-dark">Bloco {r.bloco} - nº {r.numero}</div>
            <div class="text-xs text-gray-500 mt-0.5">{r.empreendimento} · {r.tipoNome}</div>
          </div>
          <div class="flex items-center gap-2">
            {#if !r.indicariaCalper}
              <span class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-calper-red">
                não indicaria
              </span>
            {/if}
            <span class="text-xs text-gray-400">{formatarData(r.createdAt)}</span>
          </div>
        </div>
        <div class="flex flex-wrap gap-1.5 mt-3 text-[11px] font-bold">
          {#each r.notas as nota (nota.campo)}
            <span class="px-2 py-0.5 rounded-full {corNota(nota.pontos)}">
              {abreviacao[nota.campo]} {nota.pontos}
            </span>
          {/each}
        </div>
      </a>
    {:else}
      <p class="text-sm text-gray-400">Nenhum questionário encontrado.</p>
    {/each}
  </div>

  {#if data.totalPaginas > 1}
    <div class="flex items-center justify-between mt-4 text-sm">
      {#if data.pagina > 1}
        <a href={linkPagina(data.pagina - 1)} class="font-semibold text-calper-red">← Mais recentes</a>
      {:else}<span></span>{/if}
      <span class="text-gray-500">Página {data.pagina} de {data.totalPaginas}</span>
      {#if data.pagina < data.totalPaginas}
        <a href={linkPagina(data.pagina + 1)} class="font-semibold text-calper-red">Mais antigas →</a>
      {:else}<span></span>{/if}
    </div>
  {/if}
</div>
