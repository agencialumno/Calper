<script>
  import { ETAPAS, indiceEtapa } from '$lib/etapas.js';

  /** @type {{ etapa: string, detalhado?: boolean }} */
  let { etapa, detalhado = false } = $props();
  const atual = $derived(indiceEtapa(etapa));
</script>

<ol class="grid grid-cols-4 gap-0" aria-label="Etapas do empreendimento">
  {#each ETAPAS as e, i (e.id)}
    {@const concluida = i < atual}
    {@const ativa = i === atual}
    <li class="relative flex flex-col items-center text-center px-1">
      {#if i > 0}
        <span
          class="absolute top-4 right-1/2 w-full h-0.5 {i <= atual ? 'bg-calper-red' : 'bg-gray-200'}"
          aria-hidden="true"
        ></span>
      {/if}
      <span
        class="relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2
          {concluida ? 'bg-calper-red border-calper-red text-white' : ''}
          {ativa ? 'bg-white border-calper-red text-calper-red ring-4 ring-red-100' : ''}
          {!concluida && !ativa ? 'bg-white border-gray-200 text-gray-400' : ''}"
        aria-current={ativa ? 'step' : undefined}
      >
        {#if concluida}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5">
            <path d="M5 12l5 5 9-10" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        {:else}
          {i + 1}
        {/if}
      </span>
      <span
        class="mt-2.5 text-[11px] md:text-sm leading-tight {ativa
          ? 'font-extrabold text-calper-dark'
          : concluida
            ? 'font-semibold text-gray-600'
            : 'font-medium text-gray-400'}"
      >
        {e.nome}
      </span>
      {#if detalhado && ativa}
        <span class="hidden md:block mt-1 text-xs text-gray-500 max-w-[10rem]">{e.descricao}</span>
      {/if}
    </li>
  {/each}
</ol>
