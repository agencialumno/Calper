<script>
  import { enhance } from '$app/forms';
  import SubmitButton from '$lib/components/SubmitButton.svelte';
  import BackLink from '$lib/components/BackLink.svelte';

  let { data } = $props();
  const a = data.agendamento;

  let cancelando = $state(false);
  function aoCancelar() {
    cancelando = true;
    return async ({ update }) => {
      await update();
      cancelando = false;
    };
  }

  function formatarDataHora(iso) {
    return new Date(iso).toLocaleString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  const statusEstilo = {
    confirmado: { texto: 'Confirmado', bg: 'bg-green-50', fg: 'text-green-700' },
    cancelado: { texto: 'Cancelado', bg: 'bg-gray-100', fg: 'text-gray-500' },
    realizado: { texto: 'Realizado', bg: 'bg-blue-50', fg: 'text-blue-700' }
  };
</script>

<svelte:head>
  <title>{a.tipoNome} — Calper</title>
</svelte:head>

<div class="max-w-3xl mx-auto p-5 md:p-10">
  <BackLink href="/painel" label="Painel" />

  <div class="card mt-4 md:mt-6 p-7 md:p-0 md:flex md:overflow-hidden">
    <!-- QR Code -->
    <div class="md:w-[280px] md:shrink-0 md:bg-[#f9f9fa] md:flex md:flex-col md:items-center md:justify-center md:p-8 text-center">
      <span class="inline-block text-xs font-bold px-2.5 py-1 rounded-full mb-4 {statusEstilo[a.status]?.bg} {statusEstilo[a.status]?.fg}">
        {statusEstilo[a.status]?.texto ?? a.status}
      </span>

      {#if a.status === 'confirmado'}
        <div class="flex justify-center mb-4">
          <img src={data.qrDataUrl} alt="QR Code de check-in" class="w-44 h-44 md:w-48 md:h-48 rounded-xl border border-gray-100 bg-white" />
        </div>
        <p class="text-xs text-gray-400 max-w-[200px] mx-auto">
          Apresente esse QR Code no dia do evento para o check-in.
        </p>
      {/if}
    </div>

    <!-- detalhes -->
    <div class="md:flex-1 md:p-8 mt-5 md:mt-0 text-center md:text-left">
      <h1 class="text-xl md:text-2xl font-bold text-calper-dark mb-1">{a.tipoNome}</h1>
      <p class="text-sm text-gray-500 mb-6 capitalize">{formatarDataHora(a.dataHora)}</p>

      {#if a.acompanhantes.length}
        <div class="text-left border-t border-gray-100 pt-4 mb-4">
          <div class="text-xs font-bold text-gray-400 mb-1.5">ACOMPANHANTES</div>
          <ul class="text-sm text-calper-dark flex flex-col gap-1">
            {#each a.acompanhantes as nome}
              <li>{nome}</li>
            {/each}
          </ul>
        </div>
      {/if}

      {#if a.temDocumento}
        <p class="text-xs text-green-700 mb-4 text-left">Documento de identificação enviado ✓</p>
      {/if}

      {#if a.pesquisaPendente}
        <a href={`/pesquisa/${a.id}`} class="btn-primary inline-block text-sm md:max-w-xs text-center">
          Avaliar esta visita
        </a>
      {/if}

      {#if a.status === 'confirmado'}
        <form method="POST" action="?/cancelar" use:enhance={aoCancelar} class="md:max-w-xs">
          <SubmitButton loading={cancelando} variant="outline">Cancelar agendamento</SubmitButton>
        </form>
      {/if}
    </div>
  </div>
</div>