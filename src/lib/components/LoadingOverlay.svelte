<script>
  import { navigating } from '$app/stores';
  import { isBusy } from '$lib/stores/loading.js';

  let visivel = $derived(Boolean($navigating) || $isBusy);
</script>

{#if visivel}
  <div
    class="fixed inset-0 z-[9999] flex items-center justify-center bg-white/70 backdrop-blur-[2px]"
    role="status"
    aria-live="polite"
    aria-label="Carregando"
  >
    <img src="/favicon.png" alt="" class="w-14 h-14 animate-spin-calper" />
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
