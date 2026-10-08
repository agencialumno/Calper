<script>
  let { data } = $props();

  const statusEstilo = {
    confirmado: { texto: 'Confirmado', bg: 'bg-amber-50', fg: 'text-amber-700' },
    realizado: { texto: 'Realizado', bg: 'bg-green-50', fg: 'text-green-700' },
    cancelado: { texto: 'Cancelado', bg: 'bg-gray-100', fg: 'text-gray-500' }
  };

  function formatarDataHora(iso) {
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
</script>

<svelte:head>
  <title>Dashboard — Calper</title>
</svelte:head>

<div class="p-5 md:p-10 max-w-6xl">
  <div class="mb-6 md:mb-8">
    <h1 class="text-xl md:text-2xl font-bold text-calper-dark">Dashboard</h1>
    <p class="text-sm text-gray-500 mt-0.5 mb-4">Visão geral de agendamentos e engajamento</p>

    <!-- filtros: empilhados e com largura contida no mobile, pra não estourar a tela -->
    <form method="GET" class="flex flex-col sm:flex-row gap-2.5">
      <select
        name="periodo"
        class="input !py-2.5 text-sm w-full sm:w-auto min-w-0"
        onchange={(e) => e.currentTarget.form.requestSubmit()}
      >
        <option value="7" selected={data.periodo === '7'}>Últimos 7 dias</option>
        <option value="30" selected={data.periodo === '30'}>Últimos 30 dias</option>
        <option value="90" selected={data.periodo === '90'}>Últimos 90 dias</option>
        <option value="365" selected={data.periodo === '365'}>Este ano</option>
      </select>
      <select
        name="empreendimentoId"
        class="input !py-2.5 text-sm w-full sm:w-auto min-w-0"
        onchange={(e) => e.currentTarget.form.requestSubmit()}
      >
        <option value="">Todos os empreendimentos</option>
        {#each data.empreendimentos as emp}
          <option value={emp.id} selected={data.empreendimentoId === emp.id}>{emp.nome}</option>
        {/each}
      </select>
    </form>
  </div>

  <!-- kpis -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
    <div class="card p-4 md:p-5">
      <div class="text-xs text-gray-400 font-semibold">Agendamentos no período</div>
      <div class="text-2xl font-bold text-calper-dark mt-1.5">{data.kpis.total}</div>
    </div>
    <div class="card p-4 md:p-5">
      <div class="text-xs text-gray-400 font-semibold">Taxa de comparecimento</div>
      <div class="text-2xl font-bold text-calper-dark mt-1.5">
        {data.kpis.taxaComparecimento === null ? '—' : `${data.kpis.taxaComparecimento}%`}
      </div>
      {#if data.kpis.taxaComparecimento === null}
        <div class="text-xs text-gray-400 mt-0.5">sem eventos passados ainda</div>
      {/if}
    </div>
    <div class="card p-4 md:p-5">
      <div class="text-xs text-gray-400 font-semibold">Satisfação média</div>
      <div class="text-2xl font-bold text-calper-dark mt-1.5">
        {data.kpis.satisfacaoMedia === null ? '—' : `${data.kpis.satisfacaoMedia}`}<span class="text-sm text-gray-400">/5</span>
      </div>
      <div class="text-xs text-gray-400 mt-0.5">
        {data.kpis.totalPesquisas === 0 ? 'sem respostas ainda' : `de ${data.kpis.totalPesquisas} resposta(s)`}
      </div>
    </div>
    <div class="card p-4 md:p-5">
      <div class="text-xs text-gray-400 font-semibold">Indicariam a Calper</div>
      <div class="text-2xl font-bold text-calper-dark mt-1.5">
        {data.kpis.taxaIndicaria === null ? '—' : `${data.kpis.taxaIndicaria}%`}
      </div>
    </div>
  </div>

  <div class="card p-5 mb-6">
    <div class="text-xs text-gray-400 font-semibold mb-3">E-mails de atualização de obra</div>
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div>
        <div class="text-xs text-gray-400">Disparados</div>
        <div class="text-xl font-bold text-calper-dark mt-1">{data.kpis.totalEmails}</div>
      </div>
      <div>
        <div class="text-xs text-gray-400">Taxa de envio</div>
        <div class="text-xl font-bold text-calper-dark mt-1">
          {data.kpis.taxaEnvioEmail === null ? '—' : `${data.kpis.taxaEnvioEmail}%`}
        </div>
      </div>
      <div>
        <div class="text-xs text-gray-400">Taxa de abertura</div>
        <div class="text-xl font-bold text-calper-dark mt-1">
          {data.kpis.taxaAbertura === null ? '—' : `${data.kpis.taxaAbertura}%`}
        </div>
      </div>
      <div>
        <div class="text-xs text-gray-400">Taxa de clique</div>
        <div class="text-xl font-bold text-calper-dark mt-1">
          {data.kpis.taxaClique === null ? '—' : `${data.kpis.taxaClique}%`}
        </div>
      </div>
    </div>
  </div>

  <!-- gráfico + breakdown -->
  <div class="grid grid-cols-1 md:grid-cols-[1.6fr_1fr] gap-5 mb-8">
    <div class="card p-5 md:p-6 overflow-x-auto">
      <div class="text-sm font-bold text-calper-dark mb-5">Agendamentos no período</div>
      <div class="flex items-end gap-2 md:gap-3 min-w-[280px]" style="height: 150px">
        {#each data.grafico as b}
          <div class="flex-1 flex flex-col items-center gap-2 h-full justify-end">
            <div
              class="w-full rounded-t-md {b.qtd > 0 ? 'bg-calper-red' : 'bg-gray-100'}"
              style="height: {Math.max(4, b.pct)}%"
              title="{b.qtd} agendamento(s)"
            ></div>
            <div class="text-[10px] text-gray-400 whitespace-nowrap">{b.label}</div>
          </div>
        {/each}
      </div>
    </div>

    <div class="card p-5 md:p-6">
      <div class="text-sm font-bold text-calper-dark mb-4">Por tipo de evento</div>
      {#if data.breakdownTipos.length === 0}
        <p class="text-sm text-gray-400">Nenhum agendamento no período.</p>
      {:else}
        <div class="flex flex-col gap-3">
          {#each data.breakdownTipos as t}
            <div>
              <div class="flex justify-between text-xs mb-1">
                <span class="text-calper-dark font-semibold">{t.nome}</span>
                <span class="text-gray-400">{t.qtd}</span>
              </div>
              <div class="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div class="h-full bg-calper-red rounded-full" style="width: {t.pct}%"></div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <!-- recentes -->
  <div class="text-sm font-bold text-calper-dark mb-3 md:hidden">Agendamentos recentes</div>

  <!-- mobile: cards -->
  <div class="flex flex-col gap-2.5 md:hidden">
    {#each data.recentes as r (r.id)}
      <div class="card p-4 flex items-center justify-between gap-3">
        <div class="min-w-0">
          <div class="text-sm font-bold text-calper-dark truncate">{r.unidade}</div>
          <div class="text-xs text-gray-500 mt-0.5">{r.tipoNome}</div>
          <div class="text-xs text-gray-400 mt-0.5">{formatarDataHora(r.dataHora)}</div>
        </div>
        <span
          class="text-xs font-bold px-2.5 py-1 rounded-full shrink-0 {statusEstilo[r.status]?.bg} {statusEstilo[r.status]?.fg}"
        >
          {statusEstilo[r.status]?.texto ?? r.status}
        </span>
      </div>
    {:else}
      <div class="card p-8 text-center text-gray-400 text-sm">Nenhum agendamento ainda.</div>
    {/each}
  </div>

  <!-- desktop: tabela -->
  <div class="card overflow-hidden hidden md:block">
    <div class="px-5 py-4 border-b border-gray-100 text-sm font-bold text-calper-dark">
      Agendamentos recentes
    </div>
    <table class="w-full text-sm border-collapse">
      <thead>
        <tr class="text-left text-[11px] uppercase tracking-wide text-gray-400">
          <th class="px-5 py-2.5 font-bold">Unidade</th>
          <th class="px-5 py-2.5 font-bold">Evento</th>
          <th class="px-5 py-2.5 font-bold">Data</th>
          <th class="px-5 py-2.5 font-bold">Status</th>
        </tr>
      </thead>
      <tbody>
        {#each data.recentes as r (r.id)}
          <tr class="border-t border-gray-100">
            <td class="px-5 py-3 font-bold text-calper-dark">{r.unidade}</td>
            <td class="px-5 py-3 text-gray-600">{r.tipoNome}</td>
            <td class="px-5 py-3 text-gray-400">{formatarDataHora(r.dataHora)}</td>
            <td class="px-5 py-3">
              <span class="text-xs font-bold px-2 py-0.5 rounded-full {statusEstilo[r.status]?.bg} {statusEstilo[r.status]?.fg}">
                {statusEstilo[r.status]?.texto ?? r.status}
              </span>
            </td>
          </tr>
        {:else}
          <tr>
            <td colspan="4" class="px-5 py-10 text-center text-gray-400">Nenhum agendamento ainda.</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
