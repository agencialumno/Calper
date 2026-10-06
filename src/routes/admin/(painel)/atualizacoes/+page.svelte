<script>
  import { enhance } from '$app/forms';
  import SubmitButton from '$lib/components/SubmitButton.svelte';

  let { data, form } = $props();
  let publicando = $state(false);
  let arquivoNome = $state('');

  function aoSubmeter() {
    publicando = true;
    return async ({ update }) => {
      await update();
      publicando = false;
      arquivoNome = '';
    };
  }

  function formatarData(iso) {
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
</script>

<svelte:head>
  <title>Atualizações da obra — Calper</title>
</svelte:head>

<div class="p-8 max-w-3xl">
  <h1 class="text-xl font-bold text-calper-dark mb-1">Atualizações da obra</h1>
  <p class="text-sm text-gray-500 mb-7">
    Publicar um marco dispara e-mail automático para todos os investidores vinculados ao empreendimento.
  </p>

  {#if form?.sucesso}
    <div class="bg-green-50 border border-green-100 text-green-700 text-sm rounded-xl px-4 py-3 mb-6">
      Atualização publicada — {form.totalEnviados} e-mail(s) disparado(s).
    </div>
  {/if}
  {#if form?.erro}
    <div class="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3 mb-6">
      {form.erro}
    </div>
  {/if}

  <form
    method="POST"
    enctype="multipart/form-data"
    use:enhance={aoSubmeter}
    class="card p-6 flex flex-col gap-4 mb-10"
  >
    <div>
      <label for="empreendimentoId" class="block text-sm font-semibold text-calper-dark mb-1.5">
        Empreendimento
      </label>
      <select id="empreendimentoId" name="empreendimentoId" class="input" required>
        <option value="">selecione</option>
        {#each data.empreendimentos as emp}
          <option value={emp.id}>{emp.nome}</option>
        {/each}
      </select>
    </div>

    <div>
      <label for="titulo" class="block text-sm font-semibold text-calper-dark mb-1.5">
        Título do marco
      </label>
      <input id="titulo" name="titulo" class="input" placeholder="Ex: Fundação concluída" required />
    </div>

    <div>
      <label for="descricao" class="block text-sm font-semibold text-calper-dark mb-1.5">Descrição</label>
      <textarea
        id="descricao"
        name="descricao"
        class="input min-h-[90px]"
        placeholder="O que aconteceu nessa etapa..."
        required
      ></textarea>
    </div>

    <div>
      <div class="block text-sm font-semibold text-calper-dark mb-1.5">Foto (opcional)</div>
      <label class="card border-dashed p-4 flex items-center justify-center text-center cursor-pointer hover:border-calper-red">
        <span class="text-sm text-gray-500">{arquivoNome || 'Clique para enviar uma foto'}</span>
        <input
          type="file"
          name="midia"
          accept="image/jpeg,image/png"
          class="hidden"
          onchange={(e) => (arquivoNome = e.target.files?.[0]?.name ?? '')}
        />
      </label>
    </div>

    <SubmitButton loading={publicando}>Publicar e notificar investidores</SubmitButton>
  </form>

  <h2 class="text-sm font-bold text-calper-dark mb-3">Publicadas recentemente</h2>
  <div class="flex flex-col gap-2.5">
    {#each data.atualizacoes as a (a.id)}
      <div class="card p-4">
        <div class="flex items-center justify-between gap-3 mb-1">
          <div class="text-sm font-bold text-calper-dark">{a.titulo}</div>
          <div class="text-xs text-gray-400 shrink-0">{formatarData(a.createdAt)}</div>
        </div>
        <div class="text-xs text-gray-500 mb-2">{a.empreendimento}</div>
        <div class="text-xs text-gray-400">
          {a.enviados}/{a.totalEmails} e-mails enviados{a.temMidia ? ' · com foto' : ''}
        </div>
      </div>
    {:else}
      <p class="text-sm text-gray-400">Nenhuma atualização publicada ainda.</p>
    {/each}
  </div>
</div>