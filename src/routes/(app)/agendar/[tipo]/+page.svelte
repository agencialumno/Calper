<script>
  import { enhance } from '$app/forms';
  import SubmitButton from '$lib/components/SubmitButton.svelte';
  import AvisoSutil from '$lib/components/AvisoSutil.svelte';

  let { data, form } = $props();

  let acompanhantes = $state([]);
  let enviando = $state(false);
  let tentouEnviar = $state(false);

  // documento principal
  let inputPrincipal;
  let arquivoPrincipal = $state(null);
  let previewPrincipal = $state('');
  let arrastandoPrincipal = $state(false);

  const maxAcompanhantes = data.tipoEvento.limitePessoas - 1;

  function adicionarAcompanhante() {
    if (acompanhantes.length < maxAcompanhantes) {
      acompanhantes.push({ nome: '', arquivo: null, previewUrl: '', arrastando: false });
    }
  }
  function removerAcompanhante(i) {
    if (acompanhantes[i].previewUrl) URL.revokeObjectURL(acompanhantes[i].previewUrl);
    acompanhantes.splice(i, 1);
  }

  function formatarTamanho(bytes) {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function aplicarArquivoPrincipal(f) {
    arquivoPrincipal = f;
    if (previewPrincipal) URL.revokeObjectURL(previewPrincipal);
    previewPrincipal = f && f.type.startsWith('image/') ? URL.createObjectURL(f) : '';
  }

  function aoEscolherPrincipal(e) {
    aplicarArquivoPrincipal(e.target.files?.[0] ?? null);
  }

  function aoSoltarPrincipal(e) {
    e.preventDefault();
    arrastandoPrincipal = false;
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    const dt = new DataTransfer();
    dt.items.add(f);
    inputPrincipal.files = dt.files;
    aplicarArquivoPrincipal(f);
  }

  function aplicarArquivoAcompanhante(i, f) {
    if (acompanhantes[i].previewUrl) URL.revokeObjectURL(acompanhantes[i].previewUrl);
    acompanhantes[i].arquivo = f;
    acompanhantes[i].previewUrl = f && f.type.startsWith('image/') ? URL.createObjectURL(f) : '';
  }

  function aoSoltarAcompanhante(e, i, inputEl) {
    e.preventDefault();
    acompanhantes[i].arrastando = false;
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    const dt = new DataTransfer();
    dt.items.add(f);
    inputEl.files = dt.files;
    aplicarArquivoAcompanhante(i, f);
  }

  function aoSubmeter({ cancel }) {
    tentouEnviar = true;

    if (data.tipoEvento.exigeDocumento && !arquivoPrincipal) {
      cancel();
      return;
    }

    enviando = true;
    return async ({ update }) => {
      await update();
      enviando = false;
    };
  }

  const faltaDocumentoPrincipal = $derived(
    tentouEnviar && data.tipoEvento.exigeDocumento && !arquivoPrincipal
  );
</script>

<svelte:head>
  <title>Agendar {data.tipoEvento.nome} — Calper</title>
</svelte:head>

<div class="max-w-4xl mx-auto p-5 md:p-10">
  <a href="/painel" class="text-sm text-gray-500 hover:text-calper-dark">← Painel</a>

  <div class="mt-3 mb-6 md:mb-8">
    <h1 class="text-xl md:text-2xl font-bold text-calper-dark mb-1">{data.tipoEvento.nome}</h1>
    <p class="text-sm text-gray-500">
      Até {data.tipoEvento.limitePessoas} pessoa(s) no total, incluindo você.
    </p>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-[1.5fr_1fr] gap-6 md:gap-8 items-start">
  <form
    method="POST"
    enctype="multipart/form-data"
    use:enhance={aoSubmeter}
    class="card p-6 md:p-8 flex flex-col gap-5"
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
        <label for="documento-principal" class="block text-sm font-semibold text-calper-dark mb-1.5">
          Documento de identificação
        </label>

        <!-- input único e persistente — nunca é recriado, por isso o arquivo não se perde -->
        <input
          bind:this={inputPrincipal}
          id="documento-principal"
          type="file"
          name="documento"
          accept="image/jpeg,image/png,application/pdf"
          class="hidden"
          onchange={aoEscolherPrincipal}
        />

        <label
          for="documento-principal"
          class="card p-3 flex items-center gap-3 cursor-pointer transition-colors {faltaDocumentoPrincipal
            ? 'border-calper-red'
            : arrastandoPrincipal
              ? 'border-calper-red bg-[#fdeceb]'
              : 'hover:border-calper-red'} {arquivoPrincipal ? '' : 'border-dashed'}"
          ondragover={(e) => {
            e.preventDefault();
            arrastandoPrincipal = true;
          }}
          ondragleave={() => (arrastandoPrincipal = false)}
          ondrop={aoSoltarPrincipal}
        >
          {#if arquivoPrincipal}
            {#if previewPrincipal}
              <img src={previewPrincipal} alt="Pré-visualização do documento" class="w-14 h-14 rounded-lg object-cover shrink-0" />
            {:else}
              <div class="w-14 h-14 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9aa0a8" stroke-width="2">
                  <path d="M4 21V5a2 2 0 012-2h8l6 6v12a2 2 0 01-2 2H6a2 2 0 01-2-2z" />
                  <path d="M14 3v6h6" />
                </svg>
              </div>
            {/if}
            <div class="min-w-0">
              <div class="text-sm font-semibold text-calper-dark truncate">{arquivoPrincipal.name}</div>
              <div class="text-xs text-gray-400">{formatarTamanho(arquivoPrincipal.size)} · trocar arquivo</div>
            </div>
          {:else}
            <div class="flex-1 flex flex-col items-center justify-center text-center py-2.5">
              <span class="text-sm font-semibold text-calper-dark mb-0.5">
                {arrastandoPrincipal ? 'Solte o arquivo aqui' : 'Clique ou arraste (JPG, PNG ou PDF)'}
              </span>
              <span class="text-xs text-gray-400">máximo 4 MB</span>
            </div>
          {/if}
        </label>

        {#if faltaDocumentoPrincipal}
          <div class="mt-2.5">
            <AvisoSutil>
              Envie o documento de identificação — ele é obrigatório para este tipo de evento.
            </AvisoSutil>
          </div>
        {/if}
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
        <div class="flex flex-col gap-3">
          {#each acompanhantes as ac, i (i)}
            {@const inputId = `doc-acompanhante-${i}`}
            <div class="border border-gray-200 rounded-xl p-3 flex flex-col gap-2.5">
              <div class="flex gap-2">
                <input name="acompanhanteNome" bind:value={ac.nome} class="input" placeholder="Nome completo" />
                <button
                  type="button"
                  class="text-xs text-gray-400 hover:text-calper-red shrink-0 px-2"
                  onclick={() => removerAcompanhante(i)}
                >
                  remover
                </button>
              </div>

              <input
                id={inputId}
                type="file"
                name="acompanhanteDocumento"
                accept="image/jpeg,image/png,application/pdf"
                class="hidden"
                onchange={(e) => aplicarArquivoAcompanhante(i, e.target.files?.[0] ?? null)}
              />
              <label
                for={inputId}
                class="rounded-lg border border-dashed border-gray-200 p-2.5 flex items-center gap-2.5 cursor-pointer text-xs {ac.arrastando
                  ? 'border-calper-red bg-[#fdeceb]'
                  : 'hover:border-calper-red'}"
                ondragover={(e) => {
                  e.preventDefault();
                  ac.arrastando = true;
                }}
                ondragleave={() => (ac.arrastando = false)}
                ondrop={(e) => aoSoltarAcompanhante(e, i, e.currentTarget.previousElementSibling)}
              >
                {#if ac.arquivo}
                  {#if ac.previewUrl}
                    <img src={ac.previewUrl} alt="" class="w-9 h-9 rounded object-cover shrink-0" />
                  {:else}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9aa0a8" stroke-width="2" class="shrink-0">
                      <path d="M4 21V5a2 2 0 012-2h8l6 6v12a2 2 0 01-2 2H6a2 2 0 01-2-2z" />
                      <path d="M14 3v6h6" />
                    </svg>
                  {/if}
                  <span class="text-gray-600 truncate">{ac.arquivo.name} · {formatarTamanho(ac.arquivo.size)}</span>
                {:else}
                  <span class="text-gray-400">Documento do acompanhante (opcional)</span>
                {/if}
              </label>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <SubmitButton loading={enviando}>Confirmar agendamento</SubmitButton>
  </form>

  <!-- resumo (visível já no mobile embaixo do form, e fixo ao lado no desktop) -->
  <aside class="card p-6 md:sticky md:top-24 flex flex-col gap-4">
    <div>
      <div class="text-xs font-bold text-gray-400 tracking-wide mb-1">EVENTO</div>
      <div class="text-base font-bold text-calper-dark">{data.tipoEvento.nome}</div>
    </div>
    <div class="h-px bg-gray-100"></div>
    <div class="flex flex-col gap-3 text-sm">
      <div class="flex items-center gap-2.5 text-gray-600">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9aa0a8" stroke-width="2" class="shrink-0"><path d="M16 2v4M8 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z"/></svg>
        Janela de agendamento: amanhã até 90 dias à frente
      </div>
      <div class="flex items-center gap-2.5 text-gray-600">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9aa0a8" stroke-width="2" class="shrink-0"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
        Horários fixos, das {data.horarios[0]} às {data.horarios[data.horarios.length - 1]}
      </div>
      <div class="flex items-center gap-2.5 text-gray-600">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9aa0a8" stroke-width="2" class="shrink-0"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
        Até {data.tipoEvento.limitePessoas} pessoa(s) no total
      </div>
      {#if data.tipoEvento.exigeDocumento}
        <div class="flex items-center gap-2.5 text-gray-600">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9aa0a8" stroke-width="2" class="shrink-0"><path d="M4 21V5a2 2 0 012-2h8l6 6v12a2 2 0 01-2 2H6a2 2 0 01-2-2z"/><path d="M14 3v6h6"/></svg>
          Documento de identificação obrigatório
        </div>
      {/if}
    </div>
    <div class="h-px bg-gray-100"></div>
    <p class="text-xs text-gray-400 leading-relaxed">
      Depois de confirmado, você poderá cancelar a qualquer momento pela tela do agendamento.
    </p>
  </aside>
  </div>
</div>