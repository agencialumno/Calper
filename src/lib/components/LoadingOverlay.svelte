<script>
  import { navigating } from '$app/stores';
  import { fade, scale } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { isBusy } from '$lib/stores/loading.js';

  let deveCarregar = $derived(Boolean($navigating) || $isBusy);

  // Tempo mínimo visível, pra respostas muito rápidas não "piscarem" antes do fade rodar.
  const DURACAO_MINIMA_MS = 300;
  let visivel = $state(false);
  let apareceuEm = 0;

  $effect(() => {
    if (deveCarregar) {
      visivel = true;
      apareceuEm = Date.now();
    } else if (visivel) {
      const restante = DURACAO_MINIMA_MS - (Date.now() - apareceuEm);
      if (restante <= 0) {
        visivel = false;
      } else {
        const timer = setTimeout(() => (visivel = false), restante);
        return () => clearTimeout(timer);
      }
    }
  });
</script>

{#if visivel}
  <div
    class="fixed inset-0 z-[9999] flex items-center justify-center bg-white/70 backdrop-blur-[2px]"
    role="status"
    aria-live="polite"
    aria-label="Carregando"
    transition:fade={{ duration: 220, easing: cubicOut }}
  >
    <div
      class="flex flex-col items-center gap-3"
      in:scale={{ duration: 280, start: 0.85, easing: cubicOut }}
      out:scale={{ duration: 160, start: 0.9, easing: cubicOut }}
    >
      <img src="/favicon.png" alt="" class="w-12 h-12 animate-spin-calper drop-shadow-sm" />
    </div>
  </div>
{/if}

<style>
  @keyframes spin-calper {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
  .animate-spin-calper {
    animation: spin-calper 0.9s linear infinite;
  }
</style>
