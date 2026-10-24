<script>
  import LinkDownload from '$lib/components/LinkDownload.svelte';
  let { data } = $props();
  import { autoAtualizar } from '$lib/autoAtualizar.svelte.js';
  // a página se atualiza sozinha (novo agendamento, cancelamento, check-in, mudança de status)
  const auto = autoAtualizar();

  const rotuloDoc = {
    pendente: 'aguardando a Calper',
    calper_assinou: 'Calper assinou',
    aguardando_cliente: 'aguardando o cliente',
    assinado: 'assinado'
  };
  // data agendada: o relógio escolhido é gravado como UTC (ver agenda.js)
  const dataHoraAgendada = (iso) =>
    new Date(iso).toLocaleString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

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

  <!-- quem agendou: falta receber x já recebeu (bater o olho) -->
  <div class="grid grid-cols-2 gap-3 mb-5">
    <a href="#faltam" class="rounded-2xl border border-amber-200 bg-amber-50 p-4 block">
      <div class="text-3xl font-extrabold text-amber-700">{data.faltam.length}</div>
      <div class="text-sm font-bold text-amber-800">agendaram e ainda não receberam a chave</div>
    </a>
    <a href="#receberam" class="rounded-2xl border border-green-200 bg-green-50 p-4 block">
      <div class="text-3xl font-extrabold text-green-700">{data.entregas.length}</div>
      <div class="text-sm font-bold text-green-800">já receberam a chave ({data.totalEntregues} de {data.totalUnidades} unidades no total)</div>
    </a>
  </div>

  <div class="flex justify-end mb-3">
    <LinkDownload href={data.exportarEntregasHref} class="text-sm font-bold text-calper-red">Exportar CSV: recebeu x ainda não recebeu</LinkDownload>
  </div>

  <section id="faltam" class="card p-4 md:p-5 mb-6 border-l-4 border-l-amber-400">
    <h2 class="text-base font-bold text-calper-dark mb-1">Ainda não receberam a chave</h2>
    <p class="text-xs text-gray-500 mb-3">Agendaram e a entrega não foi concluída — apareceram ou não.</p>
    {#each data.faltam as f (f.agendamentoId)}
      <div class="flex flex-col md:flex-row md:items-center gap-1.5 md:gap-4 py-3 border-t border-gray-100">
        <a href="/admin/entrega-chaves/{f.agendamentoId}" class="text-sm font-bold text-calper-red md:w-40 shrink-0">{f.unidade}</a>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-semibold text-calper-dark">{f.agendouNome ?? '—'}</div>
          <div class="text-xs text-gray-500">{f.telefone ?? '—'} · {f.email ?? '—'}</div>
        </div>
        <div class="text-xs text-gray-600 md:w-36 shrink-0">agendado para {dataHoraAgendada(f.agendadoPara)}</div>
        <div class="md:w-56 shrink-0 flex flex-col gap-1 items-start">
          {#if f.compareceu}
            <span class="text-[11px] font-bold text-amber-800 bg-amber-100 rounded-full px-2.5 py-1">compareceu — entrega não concluída</span>
          {:else}
            <span class="text-[11px] font-bold text-red-700 bg-red-50 rounded-full px-2.5 py-1">não compareceu</span>
          {/if}
          {#if f.documentos.termo || f.documentos.checklist}
            <span class="text-[11px] text-gray-500">termo: {rotuloDoc[f.documentos.termo] ?? 'não enviado'} · checklist: {rotuloDoc[f.documentos.checklist] ?? 'não enviado'}</span>
          {/if}
        </div>
      </div>
    {:else}
      <p class="text-sm text-gray-400">Ninguém pendente no período. 🎉</p>
    {/each}
  </section>

  <section id="receberam" class="card p-4 md:p-5 mb-6 border-l-4 border-l-green-500">
    <h2 class="text-base font-bold text-calper-dark mb-3">Já receberam a chave</h2>
    {#each data.entregas as e (e.agendamentoId)}
      <div class="flex flex-col md:flex-row md:items-center gap-1 md:gap-4 py-2.5 border-t border-gray-100">
        <a href="/admin/unidades/{e.unidadeId}" class="text-sm font-bold text-calper-red md:w-40 shrink-0">{e.unidade}</a>
        <div class="text-sm text-calper-dark flex-1 min-w-0">
          agendou: <strong>{e.agendouNome ?? '—'}</strong> · retirou: <strong>{e.retirante ?? '—'}</strong>
        </div>
        <div class="text-xs text-gray-500 md:w-40 shrink-0">{formatarDataHora(e.entregueEm)}</div>
        {#if e.observacoes}
          <div class="basis-full text-xs text-gray-600"><strong class="text-gray-500">Obs.:</strong> {e.observacoes}</div>
        {/if}
      </div>
    {:else}
      <p class="text-sm text-gray-400">Nenhuma entrega concluída no período.</p>
    {/each}
  </section>

  <div class="flex items-center justify-between mb-3">
    <h2 class="text-base font-bold text-calper-dark">Quem compareceu</h2>
    <LinkDownload href={data.exportarHref} class="text-sm font-bold text-calper-red">Exportar CSV da lista de presença</LinkDownload>
  </div>

  <div class="card overflow-x-auto">
    {#each data.presencas as p (p.id)}
      <div class="flex flex-col md:flex-row md:items-center gap-1.5 md:gap-4 p-4 border-t border-gray-100 first:border-t-0">
        <div class="text-xs text-gray-500 md:w-40 shrink-0">{formatarDataHora(p.createdAt)}</div>
        <div class="text-sm font-semibold text-calper-dark flex-1 min-w-0">{p.nome}</div>
        <div class="text-xs text-gray-600 md:w-40 shrink-0">{p.vinculo}</div>
        <a href="/admin/unidades/{p.unidadeId}" class="text-sm font-bold text-calper-red md:w-36 shrink-0">{p.unidade}</a>
        {#if p.chaveEntregue}
          <span class="text-[11px] font-bold text-green-700 bg-green-50 rounded-full px-2.5 py-1 shrink-0">chave entregue</span>
        {/if}
        {#if p.observacoes}
          <span class="basis-full text-xs text-gray-600 md:pl-44"><strong class="text-gray-500">Obs.:</strong> {p.observacoes}</span>
        {/if}
      </div>
    {:else}
      <p class="text-sm text-gray-400 p-6">Nenhuma presença registrada no período.</p>
    {/each}
  </div>
</div>
