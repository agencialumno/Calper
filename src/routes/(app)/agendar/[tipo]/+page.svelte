<script>
  import { enhance } from '$app/forms';
  import SubmitButton from '$lib/components/SubmitButton.svelte';
  import AvisoSutil from '$lib/components/AvisoSutil.svelte';

  let { data, form } = $props();

  let acompanhantes = $state([]);
  let enviando = $state(false);
  let arquivoNome = $state('');

  const maxAcompanhantes = data.tipoEvento.limitePessoas - 1;

  function adicionarAcompanhante() {
    if (acompanhantes.length < maxAcompanhantes) acompanhantes.push({ nome: '' });
  }
  function removerAcompanhante(i) {
    acompanhantes.splice(i, 1);
  }

  function aoSubmeter() {
    enviando = true;
    return async ({ update }) => {
      await update();
      enviando = false;
    };
  }
</script>

<svelte:head>
  <title>Agendar {data.tipoEvento.nome} — Calper</title>
</svelte:head>

<div class="p-5 max-w-lg mx-auto">
  <a href="/painel" class="text-sm text-gray-500 hover:text-calper-dark">← Painel</a>

  <h1 class="text-xl font-bold text-calper-dark mt-3 mb-1">{data.tipoEvento.nome}</h1>
  <p class="text-sm text-gray-500 mb-6">
    Até {data.tipoEvento.limitePessoas} pessoa(s) no total, incluindo você.
  </p>

  <form
    method="POST"
    enctype="multipart/form-data"
    use:enhance={aoSubmeter}
    class="card p-6 flex flex-col gap-5"
  >
    {#if form?.erro}
      <AvisoSutil>{form.erro}</AvisoSutil>
    {/if}

    <div class="grid grid-cols-2 gap-4">
      <div>
        <label for="data" class="block text-sm font-semibold text-calper-dark mb-1.5">Data</label>
        <input
          id="data"
          name="data"
          type="date"
          class="input"
          min={data.dataMinima}
          max={data.dataMaxima}
          required
        />
      </div>
      <div>
        <label for="horario" class="block text-sm font-semibold text-calper-dark mb-1.5">Horário</label>
        <select id="horario" name="horario" class="input" required>
          <option value="">selecione</option>
          {#each data.horarios as h}
            <option value={h}>{h}</option>
          {/each}
        </select>
      </div>
    </div>

    {#if data.tipoEvento.exigeDocumento}
      <div>
        <div class="block text-sm font-semibold text-calper-dark mb-1.5">Documento de identificação</div>
        <label
          class="card border-dashed p-5 flex flex-col items-center justify-center text-center cursor-pointer hover:border-calper-red"
        >
          <span class="text-sm font-semibold text-calper-dark mb-0.5">
            {arquivoNome || 'Clique para enviar (JPG, PNG ou PDF)'}
          </span>
          <span class="text-xs text-gray-400">máximo 4 MB</span>
          <input
            type="file"
            name="documento"
            accept="image/jpeg,image/png,application/pdf"
            class="hidden"
            required
            onchange={(e) => (arquivoNome = e.target.files?.[0]?.name ?? '')}
          />
        </label>
      </div>
    {/if}

    {#if maxAcompanhantes > 0}
      <div>
        <div class="flex items-center justify-between mb-2">
          <div class="text-sm font-semibold text-calper-dark">Acompanhantes (opcional)</div>
          {#if acompanhantes.length < maxAcompanhantes}
            <button type="button" class="text-xs text-calper-red font-semibold" onclick={adicionarAcompanhante}>
              + adicionar
            </button>
          {/if}
        </div>
        <div class="flex flex-col gap-2">
          {#each acompanhantes as ac, i (i)}
            <div class="flex gap-2">
              <input name="acompanhante" bind:value={ac.nome} class="input" placeholder="Nome completo" />
              <button
                type="button"
                class="text-xs text-gray-400 hover:text-calper-red shrink-0 px-2"
                onclick={() => removerAcompanhante(i)}
              >
                remover
              </button>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <SubmitButton loading={enviando}>Confirmar agendamento</SubmitButton>
  </form>
</div>
