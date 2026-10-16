<script>
  import { onMount } from 'svelte';

  let { data } = $props();

  onMount(() => {
    // dentro do iframe: pede à página de fora (tela /assinar) para navegar a aba inteira
    if (window.parent !== window) {
      window.parent.postMessage({ tipo: 'calper-assinatura-fim', destino: data.destino }, window.location.origin);
    } else {
      window.location.replace(data.destino);
    }
  });
</script>

<svelte:head>
  <title>Assinatura — Calper</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-white text-gray-500 text-sm">
  Concluindo a assinatura…
</div>
