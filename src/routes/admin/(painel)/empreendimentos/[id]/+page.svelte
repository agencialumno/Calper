<script>
  import { enhance } from '$app/forms';
  import SubmitButton from '$lib/components/SubmitButton.svelte';
  import AvisoSutil from '$lib/components/AvisoSutil.svelte';

  let { data, form } = $props();
  let e = $derived(data.empreendimento);

  let progresso = $state(0);
  $effect(() => {
    progresso = data.empreendimento.progressoPercentual;
  });
  let salvando = $state(false);

  function aoSubmeter() {
    salvando = true;
    return async ({ update }) => {
      await update({ reset: false });
      salvando = false;
    };
  }
</script>

<svelte:head>
  <title>{e.nome} — Empreendimento — Calper</title>
</svelte:head>

<div class="p-5 md:p-8 max-w-3xl">
  <a href="/admin/empreendimentos" class="text-sm text-gray-500 hover:text-calper-dark">← Empreendimentos</a>
  <h1 class="text-xl font-bold text-calper-dark mt-3 mb-6">{e.nome}</h1>

  <form
    method="POST"
    enctype="multipart/form-data"
    use:enhance={aoSubmeter}
    class="card p-6 md:p-8 flex flex-col gap-6"
  >
    {#if form?.erro}
      <AvisoSutil>{form.erro}</AvisoSutil>
    {/if}
    {#if form?.sucesso}
      <div class="bg-green-50 border border-green-100 text-green-700 text-sm rounded-xl px-4 py-3">
        Salvo.{form.notificados ? ` ${form.notificados} investidor(es) notificado(s) sobre o novo progresso.` : ''}
      </div>
    {/if}

    <div>
      <label for="banner" class="block text-sm font-semibold text-calper-dark mb-1.5">
        Banner do painel do investidor (JPG ou PNG, até 4 MB)
      </label>
      <input id="banner" name="banner" type="file" accept="image/jpeg,image/png" class="input" />
      {#if e.temBanner}
        <div class="flex items-center gap-4 mt-2 text-xs text-gray-500">
          <span>Banner cadastrado — enviar outro arquivo substitui.</span>
          <label class="flex items-center gap-1.5">
            <input type="checkbox" name="removerBanner" /> remover banner
          </label>
        </div>
      {/if}
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label for="dataLancamento" class="block text-sm font-semibold text-calper-dark mb-1.5">Data de lançamento</label>
        <input id="dataLancamento" name="dataLancamento" type="date" value={e.dataLancamento} class="input" />
      </div>
      <div>
        <label for="dataEntregaPrevista" class="block text-sm font-semibold text-calper-dark mb-1.5">
          Entrega prevista
        </label>
        <input
          id="dataEntregaPrevista"
          name="dataEntregaPrevista"
          type="date"
          value={e.dataEntregaPrevista}
          class="input"
        />
      </div>
    </div>

    <div>
      <label for="progressoPercentual" class="block text-sm font-semibold text-calper-dark mb-1.5">
        Progresso da obra: <span class="text-calper-red">{progresso}%</span>
      </label>
      <div class="flex items-center gap-4">
        <input
          id="progressoPercentual"
          name="progressoPercentual"
          type="range"
          min="0"
          max="100"
          step="1"
          bind:value={progresso}
          class="flex-1 accent-[#ef2334]"
        />
        <input
          type="number"
          min="0"
          max="100"
          bind:value={progresso}
          class="input !w-24 !py-2 text-sm"
          aria-label="Progresso em número"
        />
      </div>
      <p class="text-xs text-gray-400 mt-1.5">
        Ao mudar este valor, todos os investidores do empreendimento recebem uma notificação.
      </p>
    </div>

    <div>
      <label for="jornadaTitulo" class="block text-sm font-semibold text-calper-dark mb-1.5">
        Título da página "Conheça sua jornada"
      </label>
      <input id="jornadaTitulo" name="jornadaTitulo" value={e.jornadaTitulo} class="input" />
    </div>

    <div>
      <label for="jornadaConteudo" class="block text-sm font-semibold text-calper-dark mb-1.5">
        História do projeto / conceito
      </label>
      <textarea id="jornadaConteudo" name="jornadaConteudo" rows="12" class="input">{e.jornadaConteudo}</textarea>
      <p class="text-xs text-gray-400 mt-1.5">Texto simples. Uma linha em branco separa os parágrafos.</p>
    </div>

    <SubmitButton loading={salvando}>Salvar</SubmitButton>
  </form>
</div>
