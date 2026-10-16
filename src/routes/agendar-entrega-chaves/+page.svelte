<script>
  import { enhance } from '$app/forms';
  import SubmitButton from '$lib/components/SubmitButton.svelte';
  import AvisoSutil from '$lib/components/AvisoSutil.svelte';

  let { data, form } = $props();

  let ehProprietario = $state(form?.valores?.ehProprietario ?? '');
  let enviando = $state(false);
  let modalEl = $state(null);
  let modalFechado = $state(false);

  // abre o modal assim que o servidor confirma o agendamento
  $effect(() => {
    if (form?.sucesso && modalEl && !modalFechado && !modalEl.open) modalEl.showModal();
  });
  let arquivoProcuracao = $state(null);
  let tentouEnviar = $state(false);
  const faltaProcuracao = $derived(ehProprietario === 'nao' && !arquivoProcuracao);

  function aoSubmeter({ cancel }) {
    tentouEnviar = true;
    if (faltaProcuracao) {
      cancel();
      return;
    }
    enviando = true;
    return async ({ update }) => {
      await update({ reset: false });
      enviando = false;
    };
  }

  function formatarDataBr(iso) {
    return iso.split('-').reverse().join('/');
  }
</script>

<svelte:head>
  <title>Agendar entrega de chaves — Calper</title>
</svelte:head>

<div class="max-w-xl mx-auto p-5 md:p-10">
  <img src="/logo.png" alt="Calper" class="h-8 mb-6" />
  <h1 class="text-xl md:text-2xl font-bold text-calper-dark mb-1">Agendar entrega de chaves</h1>
  <p class="text-sm text-gray-500 mb-6">Murano Residencial</p>

  {#if form?.sucesso}
    <dialog
      bind:this={modalEl}
      oncancel={(e) => e.preventDefault()}
      class="rounded-2xl p-0 w-[calc(100%-2rem)] max-w-md backdrop:bg-black/50 m-auto"
      aria-labelledby="titulo-confirmacao"
    >
      <div class="p-6 md:p-8">
        <div class="w-12 h-12 rounded-full bg-green-50 text-green-600 flex items-center justify-center mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <path d="M5 12l5 5 9-10" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
        <h2 id="titulo-confirmacao" class="text-xl font-extrabold text-calper-dark mb-1">
          Agendamento realizado com sucesso
        </h2>
        <p class="text-sm text-gray-500 mb-5">Guarde os dados abaixo.</p>

        <dl class="flex flex-col gap-3 text-sm mb-5">
          <div class="flex justify-between gap-4">
            <dt class="text-gray-500">Unidade</dt>
            <dd class="font-bold text-calper-dark text-right">{form.resumo.unidade}</dd>
          </div>
          <div class="flex justify-between gap-4">
            <dt class="text-gray-500">Data</dt>
            <dd class="font-bold text-calper-dark text-right">{formatarDataBr(form.resumo.data)}</dd>
          </div>
          <div class="flex justify-between gap-4">
            <dt class="text-gray-500">Horário</dt>
            <dd class="font-bold text-calper-dark text-right">{form.resumo.horario}</dd>
          </div>
          <div class="flex justify-between gap-4">
            <dt class="text-gray-500">Agendado por</dt>
            <dd class="font-bold text-calper-dark text-right">{form.resumo.nome}</dd>
          </div>
        </dl>

        <p class="text-xs text-gray-500 mb-6">Apresente seu documento com foto à equipe Calper no dia.</p>
        <button
          type="button"
          class="btn-primary w-full"
          onclick={() => {
            modalFechado = true;
            modalEl.close();
          }}
        >
          Entendi
        </button>
      </div>
    </dialog>

    {#if modalFechado}
      <div class="card p-6 md:p-8">
        <div class="text-lg font-bold text-calper-dark mb-2">Agendamento confirmado</div>
        <p class="text-sm text-gray-600">
          {form.resumo.unidade} — {formatarDataBr(form.resumo.data)} às {form.resumo.horario} ({form.resumo.nome}).
        </p>
        <p class="text-xs text-gray-400 mt-3">Apresente seu documento com foto à equipe Calper no dia.</p>
      </div>
    {/if}
  {:else if !data.disponivel}
    <AvisoSutil>Agendamento indisponível no momento.</AvisoSutil>
  {:else}
    <form
      method="POST"
      enctype="multipart/form-data"
      use:enhance={aoSubmeter}
      class="card p-6 md:p-8 flex flex-col gap-5"
    >
      {#if form?.erro}
        <AvisoSutil>{form.erro}</AvisoSutil>
      {/if}

      <div>
        <label for="nome" class="block text-sm font-semibold text-calper-dark mb-1.5">Nome completo</label>
        <input id="nome" name="nome" class="input" value={form?.valores?.nome ?? ''} required />
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label for="cpf" class="block text-sm font-semibold text-calper-dark mb-1.5">CPF</label>
          <input id="cpf" name="cpf" inputmode="numeric" class="input" value={form?.valores?.cpf ?? ''} required />
        </div>
        <div>
          <label for="telefone" class="block text-sm font-semibold text-calper-dark mb-1.5">Telefone</label>
          <input
            id="telefone"
            name="telefone"
            type="tel"
            class="input"
            value={form?.valores?.telefone ?? ''}
            required
          />
        </div>
      </div>

      <div>
        <label for="email" class="block text-sm font-semibold text-calper-dark mb-1.5">E-mail</label>
        <input id="email" name="email" type="email" class="input" value={form?.valores?.email ?? ''} required />
      </div>

      <div>
        <label for="unidadeId" class="block text-sm font-semibold text-calper-dark mb-1.5">Unidade</label>
        <select id="unidadeId" name="unidadeId" class="input" required>
          <option value="">selecione</option>
          {#each data.unidades as u (u.id)}
            <option value={u.id} disabled={u.agendada} selected={form?.valores?.unidadeId === u.id}>
              Bloco {u.bloco} - nº {u.numero}{u.agendada ? ' (já agendado)' : ''}
            </option>
          {/each}
        </select>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label for="data" class="block text-sm font-semibold text-calper-dark mb-1.5">Data</label>
          <input
            id="data"
            name="data"
            type="date"
            class="input"
            min={data.dataMinima}
            max={data.dataMaxima}
            value={form?.valores?.data ?? ''}
            required
          />
        </div>
        <div>
          <label for="horario" class="block text-sm font-semibold text-calper-dark mb-1.5">Horário</label>
          <select id="horario" name="horario" class="input" required>
            <option value="">selecione</option>
            {#each data.horarios as h}
              <option value={h} selected={form?.valores?.horario === h}>{h}</option>
            {/each}
          </select>
        </div>
      </div>

      <fieldset>
        <legend class="block text-sm font-semibold text-calper-dark mb-1.5">
          Eu sou o proprietário da unidade
        </legend>
        <div class="flex gap-5 text-sm text-calper-dark">
          <label class="flex items-center gap-2">
            <input type="radio" name="ehProprietario" value="sim" bind:group={ehProprietario} required /> Sim
          </label>
          <label class="flex items-center gap-2">
            <input type="radio" name="ehProprietario" value="nao" bind:group={ehProprietario} /> Não
          </label>
        </div>
      </fieldset>

      {#if ehProprietario === 'nao'}
        <div class="rounded-xl border border-gray-200 p-4 flex flex-col gap-2.5 -mt-1">
          <label for="procuracao" class="block text-sm font-semibold text-calper-dark">
            Procuração (JPG, PNG ou PDF, até 4 MB) <span class="text-calper-red">*</span>
          </label>
          <p class="text-xs text-gray-500">
            Anexe a procuração — a equipe Calper vai conferir no dossiê da unidade antes do atendimento.
          </p>
          <input
            id="procuracao"
            name="procuracao"
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            class="input"
            onchange={(e) => (arquivoProcuracao = e.currentTarget.files?.[0] ?? null)}
          />
          {#if tentouEnviar && faltaProcuracao}
            <AvisoSutil>Anexe a procuração para confirmar o agendamento.</AvisoSutil>
          {/if}
        </div>
      {/if}

      <SubmitButton loading={enviando}>Confirmar agendamento</SubmitButton>
    </form>
  {/if}
</div>
