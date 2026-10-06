<script>
  import { avaliarForcaSenha, NIVEL_LABEL } from '$lib/password.js';

  let { senha = '' } = $props();

  let resultado = $derived(avaliarForcaSenha(senha));

  const corPorNivel = {
    vazia: { barra: 'bg-gray-200', texto: 'text-gray-400' },
    fraca: { barra: 'bg-calper-red', texto: 'text-calper-red' },
    media: { barra: 'bg-amber-500', texto: 'text-amber-600' },
    forte: { barra: 'bg-green-500', texto: 'text-green-700' },
    muito_forte: { barra: 'bg-green-600', texto: 'text-green-700' }
  };
</script>

<div class="mt-2.5">
  <!-- barra de força -->
  <div class="flex gap-1.5 mb-1.5">
    {#each resultado.checklist as _, i}
      <div class="h-1.5 flex-1 rounded-full bg-gray-100 overflow-hidden">
        <div
          class="h-full rounded-full transition-all duration-300 {corPorNivel[resultado.nivel].barra}"
          style="width: {i < resultado.pontos ? '100%' : '0%'}"
        ></div>
      </div>
    {/each}
  </div>

  {#if senha}
    <div class="text-xs font-semibold {corPorNivel[resultado.nivel].texto} mb-3">
      Força da senha: {NIVEL_LABEL[resultado.nivel]}
    </div>
  {/if}

  <!-- checklist -->
  <ul class="flex flex-col gap-1.5">
    {#each resultado.checklist as item (item.chave)}
      <li class="flex items-center gap-2 text-xs">
        <span
          class="w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-colors duration-200 {item.cumprido
            ? 'bg-green-500'
            : 'bg-gray-200'}"
        >
          {#if item.cumprido}
            <svg
              width="9"
              height="9"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              stroke-width="3.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
          {/if}
        </span>
        <span class="transition-colors duration-200 {item.cumprido ? 'text-green-700' : 'text-gray-500'}">
          {item.rotulo}
        </span>
      </li>
    {/each}
  </ul>
</div>
