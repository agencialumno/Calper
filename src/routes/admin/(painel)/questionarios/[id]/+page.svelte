<script>
  let { data } = $props();
  let r = $derived(data.resposta);

  function corNota(pontos) {
    if (pontos >= 4) return 'bg-green-50 text-green-700';
    if (pontos === 3) return 'bg-amber-50 text-amber-700';
    return 'bg-red-50 text-calper-red';
  }

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
  <title>Questionário — Bloco {r.bloco} nº {r.numero} — Calper</title>
</svelte:head>

<div class="p-5 md:p-8 max-w-3xl">
  <a href="/admin/questionarios" class="text-sm text-gray-500 hover:text-calper-dark">← Questionários</a>

  <h1 class="text-xl font-bold text-calper-dark mt-3">
    <a href="/admin/unidades/{r.unidadeId}" class="hover:text-calper-red">Bloco {r.bloco} - nº {r.numero}</a>
  </h1>
  <p class="text-sm text-gray-500 mt-0.5 mb-6">
    {r.empreendimento} · {r.tipoNome} em {formatarDataHora(r.dataEvento)}<br />
    Respondido por {r.respondente} em {formatarDataHora(r.createdAt)}
  </p>

  <div class="card p-6 flex flex-col gap-3 mb-5">
    {#each r.notas as n (n.campo)}
      <div class="flex items-center justify-between gap-3 text-sm">
        <span class="text-calper-dark">{n.rotulo}</span>
        <span class="text-xs font-bold px-2.5 py-1 rounded-full {corNota(n.pontos)}">{n.resposta} ({n.pontos})</span>
      </div>
    {/each}
  </div>

  <div class="card p-6 flex flex-col gap-3 mb-5 text-sm">
    <div class="flex items-center justify-between gap-3">
      <span class="text-calper-dark">Foi atendido no horário agendado?</span>
      <span
        class="text-xs font-bold px-2.5 py-1 rounded-full {r.atendidoNoHorario
          ? 'bg-green-50 text-green-700'
          : 'bg-red-50 text-calper-red'}">{r.atendidoNoHorario ? 'Sim' : 'Não'}</span
      >
    </div>
    <div class="flex items-center justify-between gap-3">
      <span class="text-calper-dark">Indicaria a Calper?</span>
      <span
        class="text-xs font-bold px-2.5 py-1 rounded-full {r.indicariaCalper
          ? 'bg-green-50 text-green-700'
          : 'bg-red-50 text-calper-red'}">{r.indicariaCalper ? 'Sim' : 'Não'}</span
      >
    </div>
  </div>

  <div class="card p-6 flex flex-col gap-5 text-sm">
    <div>
      <div class="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Pontos fortes</div>
      <p class="text-calper-dark whitespace-pre-line">{r.pontosFortes ?? '—'}</p>
    </div>
    <div>
      <div class="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Oportunidades de melhoria</div>
      <p class="text-calper-dark whitespace-pre-line">{r.oportunidadesMelhoria ?? '—'}</p>
    </div>
  </div>
</div>
