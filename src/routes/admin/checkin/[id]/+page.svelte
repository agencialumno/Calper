<script>
  import { enhance } from '$app/forms';
  import SubmitButton from '$lib/components/SubmitButton.svelte';

  let { data, form } = $props();
  const a = data.agendamento;
  const u = data.unidade;

  let confirmando = $state(false);
  function aoConfirmar() {
    confirmando = true;
    return async ({ update }) => {
      await update();
      confirmando = false;
    };
  }

  function formatarDataHora(iso) {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  const statusEstilo = {
    confirmado: { texto: 'Aguardando check-in', bg: 'bg-amber-50', fg: 'text-amber-700' },
    realizado: { texto: 'Check-in realizado', bg: 'bg-green-50', fg: 'text-green-700' },
    cancelado: { texto: 'Cancelado', bg: 'bg-gray-100', fg: 'text-gray-500' }
  };

  const status = $derived(form?.sucesso ? 'realizado' : a.status);
</script>

<svelte:head>
  <title>Check-in — {u.numero} — Calper</title>
</svelte:head>

<div class="p-5 max-w-3xl mx-auto">
  <a href="/admin/checkin" class="text-sm text-gray-500 hover:text-calper-dark">← Check-in</a>

  <div class="flex items-center justify-between flex-wrap gap-3 mt-3 mb-5">
    <div>
      <h1 class="text-lg font-bold text-calper-dark">Unidade {u.numero} — Bloco {u.bloco}</h1>
      <p class="text-sm text-gray-500 mt-0.5">{u.empreendimento} · {a.tipoNome}</p>
    </div>
    <span class="text-xs font-bold px-2.5 py-1 rounded-full {statusEstilo[status]?.bg} {statusEstilo[status]?.fg}">
      {statusEstilo[status]?.texto ?? status}
    </span>
  </div>

  {#if form?.erro}
    <div class="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-3.5 py-3 mb-5">
      {form.erro}
    </div>
  {/if}

  <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
    <!-- visitante -->
    <div class="card p-6">
      <div class="text-sm font-bold text-calper-dark mb-4">Visitante</div>

      <div class="flex items-center gap-3 mb-5">
        <div class="w-12 h-12 rounded-full bg-calper-dark text-white flex items-center justify-center font-bold">
          {a.investidorNome.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <div class="font-bold text-sm text-calper-dark">{a.investidorNome}</div>
          <div class="text-xs text-gray-500">CPF: {a.investidorCpf}</div>
        </div>
      </div>

      {#if a.documentoBase64}
        <div class="rounded-xl bg-gray-50 p-3 mb-4">
          {#if a.documentoBase64.startsWith('data:application/pdf')}
            <a href={a.documentoBase64} target="_blank" class="text-xs font-semibold text-calper-red">
              Abrir documento (PDF)
            </a>
          {:else}
            <img src={a.documentoBase64} alt="Documento de identificação" class="w-full rounded-lg" />
          {/if}
        </div>
      {:else}
        <p class="text-xs text-gray-400 mb-4">Nenhum documento enviado para este agendamento.</p>
      {/if}

      <div class="grid grid-cols-2 gap-3 text-sm mb-5">
        <div>
          <div class="text-xs text-gray-400 font-semibold">Horário</div>
          <div class="font-semibold text-calper-dark">{formatarDataHora(a.dataHora)}</div>
        </div>
        <div>
          <div class="text-xs text-gray-400 font-semibold">Acompanhantes</div>
          <div class="font-semibold text-calper-dark">{a.acompanhantes.length}</div>
        </div>
      </div>

            {#if a.acompanhantes.length}
        <div class="flex flex-col gap-2 mb-5">
          {#each a.acompanhantes as ac}
            <div class="flex items-center gap-2.5 text-sm">
              {#if ac.documentoBase64}
                {#if ac.documentoBase64.startsWith('data:application/pdf')}
                  <a href={ac.documentoBase64} target="_blank" class="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dd0417" stroke-width="2"><path d="M4 21V5a2 2 0 012-2h8l6 6v12a2 2 0 01-2 2H6a2 2 0 01-2-2z"/><path d="M14 3v6h6"/></svg>
                  </a>
                {:else}
                  <img src={ac.documentoBase64} alt="Documento de {ac.nome}" class="w-9 h-9 rounded-lg object-cover shrink-0" />
                {/if}
              {:else}
                <div class="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center shrink-0 text-[9px] text-gray-400 text-center leading-tight">
                  sem doc.
                </div>
              {/if}
              <span class="text-calper-dark">{ac.nome}</span>
            </div>
          {/each}
        </div>
      {/if}

      {#if status === 'confirmado'}
        <form method="POST" action="?/confirmar" use:enhance={aoConfirmar}>
          <SubmitButton loading={confirmando}>Confirmar presença</SubmitButton>
        </form>
      {:else if status === 'realizado'}
        <div class="text-sm text-green-700 font-semibold text-center py-2">Check-in já confirmado ✓</div>
      {/if}
    </div>

    <!-- dossiê -->
    <div class="card p-6">
      <div class="text-sm font-bold text-calper-dark mb-4">Dossiê da unidade</div>
      <div class="grid grid-cols-2 gap-3 text-sm mb-4">
        <div>
          <div class="text-xs text-gray-400 font-semibold">Status</div>
          <div class="font-semibold text-calper-dark">{u.status.replace('_', ' ')}</div>
        </div>
        <div>
          <div class="text-xs text-gray-400 font-semibold">Investidores</div>
          <div class="font-semibold text-calper-dark">{u.investidores.length}</div>
        </div>
      </div>
      <a href={`/admin/unidades/${u.id}`} class="btn-outline inline-block text-sm">Ver dossiê completo</a>
    </div>
  </div>
</div>