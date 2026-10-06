<script>
  import { enhance } from '$app/forms';
  import SubmitButton from '$lib/components/SubmitButton.svelte';

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

<div class="p-5 max-w-md mx-auto">
  <a href="/painel" class="text-sm text-gray-500 hover:text-calper-dark">← Painel</a>

  <div class="card p-7 mt-4 text-center">
    <span class="inline-block text-xs font-bold px-2.5 py-1 rounded-full mb-4 {statusEstilo[a.status]?.bg} {statusEstilo[a.status]?.fg}">
      {statusEstilo[a.status]?.texto ?? a.status}
    </span>

    <h1 class="text-lg font-bold text-calper-dark mb-1">{a.tipoNome}</h1>
    <p class="text-sm text-gray-500 mb-6 capitalize">{formatarDataHora(a.dataHora)}</p>

    {#if a.status === 'confirmado'}
      <div class="flex justify-center mb-5">
        <img src={data.qrDataUrl} alt="QR Code de check-in" class="w-48 h-48 rounded-xl border border-gray-100" />
      </div>
      <p class="text-xs text-gray-400 mb-6">
        Apresente esse QR Code no dia do evento para o check-in.
      </p>
    {/if}

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
      <p class="text-xs text-green-700 mb-4">Documento de identificação enviado ✓</p>
    {/if}

    {#if a.status === 'confirmado'}
      <form method="POST" action="?/cancelar" use:enhance={aoCancelar}>
        <SubmitButton loading={cancelando} variant="outline">Cancelar agendamento</SubmitButton>
      </form>
    {/if}
  </div>
</div>
