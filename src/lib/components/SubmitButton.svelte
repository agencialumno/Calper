<script>
  import { fade } from 'svelte/transition';

  let {
    loading = false,
    variant = 'primary', // 'primary' | 'outline'
    class: className = '',
    children,
    ...rest
  } = $props();

  const base =
    'w-full relative overflow-hidden rounded-xl font-semibold px-5 py-3.5 text-[15px] transition-all duration-200 disabled:cursor-not-allowed';

  const estiloPrimary = 'bg-gradient-to-br from-[#ef2334] to-[#b80311] text-white hover:opacity-90';
  const estiloOutline = 'bg-white border border-gray-200 text-calper-dark hover:bg-gray-50';
  const estiloLoading = 'bg-white text-calper-dark shadow-md border border-gray-100';
</script>

<button
  {...rest}
  type={rest.type ?? 'submit'}
  disabled={loading || rest.disabled}
  class="{base} {loading ? estiloLoading : variant === 'primary' ? estiloPrimary : estiloOutline} {className}"
>
  <span class="inline-flex items-center justify-center gap-2 transition-opacity duration-150 {loading ? 'opacity-0' : 'opacity-100'}">
    {@render children?.()}
  </span>

  {#if loading}
    <span class="absolute inset-0 flex items-center justify-center" transition:fade={{ duration: 160 }}>
      <img src="/favicon.png" alt="" class="w-5 h-5 animate-spin-calper" />
    </span>
  {/if}
</button>

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
