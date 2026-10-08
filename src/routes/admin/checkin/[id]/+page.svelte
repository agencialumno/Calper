<script>
  import { goto } from '$app/navigation';
  import QrScanner from '$lib/components/QrScanner.svelte';
  import BackLink from '$lib/components/BackLink.svelte';

  let { data } = $props();
  let q = $state(data.q);

  function aoDetectarQr(valor) {
    goto(`/admin/checkin?q=${encodeURIComponent(valor)}`);
  }

  function formatarDataHora(iso) {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
</script>

<svelte:head>
  <title>Check-in — Calper</title>
</svelte:head>

<div class="p-6 max-w-md mx-auto">
  <div class="mb-3">
    <BackLink href="/admin/dashboard" label="Painel" />
  </div>
  <h1 class="text-lg font-bold text-calper-dark mb-1">Check-in</h1>
  <p class="text-sm text-gray-500 mb-5">Escaneie o QR Code ou busque pela unidade</p>

  <QrScanner onDetected={aoDetectarQr} />

  <form method="GET" class="mt-5">
    <input
      type="text"
      name="q"
      bind:value={q}
      placeholder="Buscar por unidade, bloco ou empreendimento..."
      class="input"
    />
  </form>

  {#if data.q && data.resultados.length === 0}
    <p class="text-sm text-gray-400 mt-6 text-center">Nenhum agendamento em aberto encontrado.</p>
  {/if}

  {#if data.resultados.length > 0}
    <div class="flex flex-col gap-2.5 mt-5">
      {#each data.resultados as r}
        <a href={`/admin/checkin/${r.agendamentoId}`} class="card p-4 flex items-center justify-between hover:border-calper-red">
          <div>
            <div class="text-sm font-bold text-calper-dark">{r.unidade}</div>
            <div class="text-xs text-gray-500 mt-0.5">{r.empreendimento} · {r.tipoNome}</div>
          </div>
          <div class="text-xs text-gray-400 shrink-0 ml-3">{formatarDataHora(r.dataHora)}</div>
        </a>
      {/each}
    </div>
  {/if}
</div>