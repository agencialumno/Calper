<script>
  import { enhance } from '$app/forms';
  import SubmitButton from '$lib/components/SubmitButton.svelte';
  import AvisoSutil from '$lib/components/AvisoSutil.svelte';
  import { ESCALA } from '$lib/pesquisa.js';

  let { data, form } = $props();

  let enviando = $state(false);
  function aoSubmeter() {
    enviando = true;
    return async ({ update }) => {
      await update();
      enviando = false;
    };
  }
</script>

<svelte:head>
  <title>Pesquisa de satisfação — Calper</title>
</svelte:head>

<div class="max-w-2xl mx-auto p-5 md:p-10">
  <a href="/painel" class="text-sm text-gray-500 hover:text-calper-dark">← Painel</a>

  <div class="mt-3 mb-6 md:mb-8">
    <h1 class="text-xl md:text-2xl font-bold text-calper-dark mb-1">Como foi sua visita?</h1>
    <p class="text-sm text-gray-500">{data.tipoNome} — sua opinião ajuda a melhorar a jornada.</p>
  </div>

  <form method="POST" use:enhance={aoSubmeter} class="card p-6 md:p-8 flex flex-col gap-7">
    {#if form?.erro}
      <AvisoSutil>{form.erro}</AvisoSutil>
    {/if}

    {#each data.perguntasEscala as p}
      <fieldset>
        <legend class="text-sm font-semibold text-calper-dark mb-2.5">{p.rotulo}</legend>
        <div class="flex flex-wrap gap-2">
          {#each ESCALA as opcao}
            <label
              class="cursor-pointer text-sm px-3.5 py-2 rounded-lg border border-gray-200 has-[:checked]:border-calper-red has-[:checked]:bg-[#fdeceb] has-[:checked]:text-calper-red has-[:checked]:font-semibold text-gray-600"
            >
              <input type="radio" name={p.campo} value={opcao.valor} class="sr-only" required />
              {opcao.rotulo}
            </label>
          {/each}
        </div>
      </fieldset>
    {/each}

    <fieldset>
      <legend class="text-sm font-semibold text-calper-dark mb-2.5">
        Foi atendido no horário agendado?
      </legend>
      <div class="flex gap-2">
        {#each [['sim', 'Sim'], ['nao', 'Não']] as [valor, rotulo]}
          <label
            class="cursor-pointer text-sm px-4 py-2 rounded-lg border border-gray-200 has-[:checked]:border-calper-red has-[:checked]:bg-[#fdeceb] has-[:checked]:text-calper-red has-[:checked]:font-semibold text-gray-600"
          >
            <input type="radio" name="atendidoNoHorario" value={valor} class="sr-only" required />
            {rotulo}
          </label>
        {/each}
      </div>
    </fieldset>

    <fieldset>
      <legend class="text-sm font-semibold text-calper-dark mb-2.5">Indicaria a Calper?</legend>
      <div class="flex gap-2">
        {#each [['sim', 'Sim'], ['nao', 'Não']] as [valor, rotulo]}
          <label
            class="cursor-pointer text-sm px-4 py-2 rounded-lg border border-gray-200 has-[:checked]:border-calper-red has-[:checked]:bg-[#fdeceb] has-[:checked]:text-calper-red has-[:checked]:font-semibold text-gray-600"
          >
            <input type="radio" name="indicariaCalper" value={valor} class="sr-only" required />
            {rotulo}
          </label>
        {/each}
      </div>
    </fieldset>

    <div>
      <label for="pontosFortes" class="block text-sm font-semibold text-calper-dark mb-1.5">
        Pontos fortes (opcional)
      </label>
      <textarea id="pontosFortes" name="pontosFortes" class="input min-h-[80px]"></textarea>
    </div>

    <div>
      <label for="oportunidadesMelhoria" class="block text-sm font-semibold text-calper-dark mb-1.5">
        Oportunidades de melhoria (opcional)
      </label>
      <textarea id="oportunidadesMelhoria" name="oportunidadesMelhoria" class="input min-h-[80px]"></textarea>
    </div>

    <SubmitButton loading={enviando}>Enviar pesquisa</SubmitButton>
  </form>
</div>