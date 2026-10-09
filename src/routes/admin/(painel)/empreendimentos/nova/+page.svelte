<script>
  import { enhance } from '$app/forms';
  import SubmitButton from '$lib/components/SubmitButton.svelte';

  let { data, form } = $props();
  let etapa = $state(form?.etapa || data.etapaPadrao);
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
  <title>Novo empreendimento — Calper</title>
</svelte:head>

<div class="p-5 md:p-10 max-w-2xl">
  <a href="/admin/unidades" class="text-sm font-semibold text-gray-500 hover:text-calper-dark">← Unidades</a>

  <header class="mt-4 mb-8">
    <h1 class="text-2xl md:text-3xl font-extrabold text-calper-dark">Novo empreendimento</h1>
    <p class="text-sm md:text-base text-gray-500 mt-1.5">
      Depois de criado, você poderá cadastrar unidades e publicar atualizações da obra para ele.
    </p>
  </header>

  <form method="POST" use:enhance={aoSubmeter} class="card p-6 md:p-8 flex flex-col gap-7">
    {#if form?.erro}
      <div class="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{form.erro}</div>
    {/if}

    <div>
      <label for="nome" class="block text-sm font-bold text-calper-dark mb-2">Nome do empreendimento</label>
      <input id="nome" name="nome" class="input" placeholder="Ex: Arte Botânica" value={form?.nome ?? ''} required />
    </div>

    <fieldset>
      <legend class="text-sm font-bold text-calper-dark mb-1">Etapa atual</legend>
      <p class="text-sm text-gray-500 mb-3">
        Define a linha do tempo que o investidor vê e quais agendamentos ficam liberados.
      </p>
      <div class="grid gap-2.5">
        {#each data.etapas as e (e.id)}
          <label
            class="flex items-start gap-3 rounded-xl border px-4 py-3.5 cursor-pointer transition-colors {etapa === e.id
              ? 'border-calper-red bg-red-50/40'
              : 'border-gray-200 hover:bg-gray-50'}"
          >
            <input type="radio" name="etapa" value={e.id} bind:group={etapa} class="mt-1 accent-calper-red" />
            <span>
              <span class="block text-[15px] font-bold text-calper-dark">{e.nome}</span>
              <span class="block text-sm text-gray-500 mt-0.5">{e.descricao}</span>
            </span>
          </label>
        {/each}
      </div>
    </fieldset>

    <SubmitButton loading={salvando}>Criar empreendimento</SubmitButton>
  </form>
</div>
