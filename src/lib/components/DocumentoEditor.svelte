<script>
  import { enhance } from '$app/forms';
  import AvisoSutil from '$lib/components/AvisoSutil.svelte';

  // Texto de um documento já preenchido com os dados da unidade, editável. Permite baixar o PDF
  // ou enviar o mesmo texto pra assinatura no DocuSign (vinculada ao agendamento de entrega).
  let { titulo, texto, unidadeId, tipo, rotuloUnidade, voltarHref, assinatura, aviso = null, erro = null } = $props();

  let editado = $state('');
  $effect(() => {
    editado = texto;
  });
  let enviando = $state(false);
  const pendentes = $derived([...new Set(editado.match(/\{\{\s*\w+\s*\}\}/g) ?? [])]);

  const rotuloStatus = { pendente: 'Assinatura pendente', assinado: 'Assinado' };
  const corStatus = { pendente: 'bg-amber-50 text-amber-700', assinado: 'bg-green-50 text-green-700' };
</script>

<div class="p-5 md:p-8 max-w-3xl">
  <a href={voltarHref} class="text-sm text-gray-500 hover:text-calper-dark">← Unidade</a>
  <div class="flex items-center gap-3 flex-wrap mt-3">
    <h1 class="text-xl font-bold text-calper-dark">{titulo}</h1>
    <span class="text-xs font-bold px-2.5 py-1 rounded-full {corStatus[assinatura.status] ?? 'bg-gray-100 text-gray-500'}">
      {rotuloStatus[assinatura.status] ?? 'Não enviado para assinatura'}
    </span>
  </div>
  <p class="text-sm text-gray-500 mt-0.5 mb-5">{rotuloUnidade}</p>

  {#if erro}<div class="mb-4"><AvisoSutil>{erro}</AvisoSutil></div>{/if}
  {#if aviso === 'nao-assinado'}
    <div class="mb-4"><AvisoSutil>A assinatura não foi concluída. Envie novamente para assinar.</AvisoSutil></div>
  {/if}

  <form
    method="POST"
    action="?/enviar"
    use:enhance={() => {
      enviando = true;
      return async ({ update }) => {
        await update({ reset: false });
        enviando = false;
      };
    }}
    class="card p-6 flex flex-col gap-3"
  >
    <textarea name="texto" rows="28" bind:value={editado} class="input text-sm font-mono" required></textarea>

    {#if pendentes.length > 0}
      <p class="text-xs text-amber-700">
        Ainda faltam dados: {pendentes.join(', ')}. Preencha em Documentos (dados fixos do empreendimento) ou
        corrija o texto acima.
      </p>
    {/if}
    {#if assinatura.retirante}
      <p class="text-xs text-gray-500">
        Assina (quem retira): <strong>{assinatura.retirante.nome}</strong> ({assinatura.retirante.email})
        {#if assinatura.agendadoPor}· agendamento feito por {assinatura.agendadoPor}{/if}
      </p>
    {/if}
    {#if assinatura.bloqueio && assinatura.status !== 'assinado'}
      <p class="text-xs text-amber-700">
        {assinatura.bloqueio}
        {#if assinatura.agendamentoId}
          <a href="/admin/entrega-chaves/{assinatura.agendamentoId}?passo=2" class="font-bold text-calper-red">Abrir fluxo →</a>
        {/if}
      </p>
    {/if}

    <div class="flex gap-3 items-center flex-wrap">
      <button
        type="submit"
        disabled={enviando || Boolean(assinatura.bloqueio) || assinatura.status === 'assinado'}
        class="btn-primary text-sm !py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {assinatura.status === 'pendente' ? 'Reenviar para assinatura' : 'Enviar para assinatura'}
      </button>
      <button
        type="submit"
        formaction="/admin/unidades/{unidadeId}/documento-pdf"
        formmethod="POST"
        name="tipo"
        value={tipo}
        class="btn-outline text-sm !py-2.5"
      >
        Baixar PDF
      </button>
      {#if assinatura.status === 'assinado' && assinatura.agendamentoId}
        <a
          href="/admin/entrega-chaves/{assinatura.agendamentoId}/documento/{tipo === 'termo' ? 'termo' : 'checklist'}"
          class="text-sm font-bold text-calper-red"
        >
          Baixar PDF assinado
        </a>
      {/if}
      <button type="button" class="text-xs font-semibold text-gray-500" onclick={() => (editado = texto)}>
        Restaurar texto original
      </button>
    </div>
  </form>
</div>
