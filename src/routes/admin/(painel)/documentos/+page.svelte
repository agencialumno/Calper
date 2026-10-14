<script>
  import { enhance } from '$app/forms';
  import SubmitButton from '$lib/components/SubmitButton.svelte';

  let { data, form } = $props();
  let salvando = $state('');

  function aoSubmeter(chave) {
    return () => {
      salvando = chave;
      return async ({ update }) => {
        await update({ reset: false });
        salvando = '';
      };
    };
  }
</script>

<svelte:head>
  <title>Documentos — Calper</title>
</svelte:head>

<div class="p-5 md:p-8 max-w-4xl">
  <h1 class="text-xl font-bold text-calper-dark">Documentos da entrega de chaves</h1>

  {#if data.semMurano}
    <p class="text-sm text-gray-400 mt-4">Empreendimento Murano não encontrado.</p>
  {:else}
    <p class="text-sm text-gray-500 mt-0.5 mb-6">{data.empreendimento}</p>

    {#if form?.erro}
      <p class="text-sm text-calper-red mb-4">{form.erro}</p>
    {/if}

    <div class="card p-6 mb-5">
      <div class="text-sm font-bold text-calper-dark mb-1">Dados fixos do empreendimento</div>
      <p class="text-xs text-gray-500 mb-4">
        Preenchem as variáveis do termo. Campos vazios aparecem como {'{{variavel}}'} para o atendente completar.
      </p>
      <form
        method="POST"
        action="?/salvarVariaveis"
        use:enhance={aoSubmeter('variaveis')}
        class="grid grid-cols-1 sm:grid-cols-2 gap-4"
      >
        {#each data.variaveis as v (v.chave)}
          <div>
            <label for={v.chave} class="flex items-center gap-2 text-xs font-semibold text-gray-500 mb-1">
              {v.rotulo}
              {#if v.ficticio}
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                  fictício — revisar antes de usar
                </span>
              {/if}
            </label>
            <input
              id={v.chave}
              name={v.chave}
              class="input !py-2 text-sm {v.ficticio ? '!border-amber-400 bg-amber-50' : ''}"
              value={v.valor}
            />
          </div>
        {/each}
        <div class="sm:col-span-2 sm:w-48">
          <SubmitButton loading={salvando === 'variaveis'} variant="outline" class="!py-2.5 text-sm">
            Salvar dados fixos
          </SubmitButton>
          {#if form?.sucesso === 'variaveis'}<span class="text-xs text-green-700">Salvo.</span>{/if}
        </div>
      </form>
    </div>

    {#each [{ tipo: 'termo_entrega_chaves', titulo: 'Termo de entrega de chaves', doc: data.termo }, { tipo: 'checklist', titulo: 'Checklist', doc: data.checklist }] as t (t.tipo)}
      <form
        method="POST"
        action="?/salvarTexto"
        use:enhance={aoSubmeter(t.tipo)}
        class="card p-6 mb-5 flex flex-col gap-3"
      >
        <input type="hidden" name="tipo" value={t.tipo} />
        <label for={t.tipo} class="text-sm font-bold text-calper-dark">{t.titulo}</label>
        <textarea id={t.tipo} name="conteudo" rows="18" class="input text-sm font-mono" required>{t.doc.conteudo}</textarea>
        <p class="text-xs text-gray-400">
          Variáveis: {'{{bloco}} {{unidade}} {{proprietarios}} {{assinante}} {{dataAssinatura}}'}
          {#if t.tipo === 'checklist'}{'{{chavesInterior}}'} · cada item é uma linha "N. descrição — Qtde. valor"{/if}
        </p>
        <div class="sm:w-48">
          <SubmitButton loading={salvando === t.tipo} class="!py-2.5 text-sm">Salvar texto</SubmitButton>
        </div>
        {#if form?.sucesso === t.tipo}<span class="text-xs text-green-700">Salvo.</span>{/if}
      </form>
    {/each}
  {/if}
</div>
