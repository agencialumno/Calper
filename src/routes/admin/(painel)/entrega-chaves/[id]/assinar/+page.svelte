<script>
  import { onMount } from 'svelte';
  import AvisoSutil from '$lib/components/AvisoSutil.svelte';

  let { data } = $props();

  // A página de retorno do DocuSign (dentro do iframe) avisa por postMessage; aqui a aba inteira
  // navega para a tela que confere o envelope, sem deixar o retorno aninhado no iframe.
  onMount(() => {
    function aoReceber(e) {
      if (e.origin !== window.location.origin) return;
      const msg = e.data;
      if (msg?.tipo !== 'calper-assinatura-fim') return;
      if (typeof msg.destino === 'string' && msg.destino.startsWith('/admin/entrega-chaves/')) {
        window.location.href = msg.destino;
      }
    }
    window.addEventListener('message', aoReceber);
    return () => window.removeEventListener('message', aoReceber);
  });
</script>

<svelte:head>
  <title>Assinatura — {data.tituloDocumento} — Calper</title>
</svelte:head>

<div class="p-5 md:p-8 max-w-5xl">
  <a href={data.voltarPara} class="text-sm text-gray-500 hover:text-calper-dark">← Voltar</a>
  <h1 class="text-xl font-bold text-calper-dark mt-3 mb-1">{data.tituloDocumento}</h1>
  <p class="text-sm text-gray-500 mb-4">
    {data.unidade} · assina: <strong>{data.signatario}</strong>
  </p>

  {#if data.erro}
    <AvisoSutil>{data.erro}</AvisoSutil>
    <a href={data.voltarPara} class="btn-outline inline-block text-sm mt-4">Voltar</a>
  {:else}
    <div class="card overflow-hidden">
      <iframe
        src={data.urlAssinatura}
        title="Assinatura — {data.tituloDocumento}"
        class="w-full block"
        style="height: min(82vh, 900px); min-height: 560px; border: 0"
        allow="clipboard-write"
      ></iframe>
    </div>
    <p class="text-xs text-gray-400 mt-3">
      A assinatura acontece aqui mesmo, sem sair do Calper. Se a janela não carregar, recarregue esta página.
    </p>
  {/if}
</div>
