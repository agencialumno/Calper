<script>
  let { data } = $props();

  function formatarData(iso) {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  }
</script>

<svelte:head>
  <title>Jornada — Calper</title>
</svelte:head>

<div class="max-w-3xl mx-auto p-5 md:p-10">
  <a href="/painel" class="text-sm text-gray-500 hover:text-calper-dark">← Painel</a>

  <div class="mt-3 mb-8 md:mb-10">
    <h1 class="text-xl md:text-3xl font-bold text-calper-dark">{data.empreendimento}</h1>
    <p class="text-sm md:text-base text-gray-500 mt-1">
      Estágio atual: <span class="font-semibold text-calper-red">{data.estagioAtual}</span>
    </p>
  </div>

  {#if data.atualizacoes.length === 0}
    <p class="text-sm text-gray-400">Ainda não há atualizações publicadas para este empreendimento.</p>
  {:else}
    <div class="flex flex-col">
      {#each data.atualizacoes as a, i (a.id)}
        <div class="flex gap-4">
          <div class="flex flex-col items-center">
            <div class="w-3 h-3 rounded-full {i === 0 ? 'bg-calper-red' : 'bg-gray-300'} mt-1.5 shrink-0"></div>
            {#if i < data.atualizacoes.length - 1}
              <div class="w-px flex-1 bg-gray-200"></div>
            {/if}
          </div>
                    <div class="pb-9 min-w-0 flex-1">
            <div class="text-xs text-gray-400 mb-1.5">{formatarData(a.createdAt)}</div>
            <div class="card p-5 md:p-6 hover:shadow-sm transition-shadow">
              {#if a.midiaBase64}
                <img src={a.midiaBase64} alt={a.titulo} class="w-full rounded-lg mb-4 object-cover max-h-72" />
              {/if}
              <div class="font-bold text-calper-dark text-base md:text-lg mb-1.5">{a.titulo}</div>
              <div class="text-sm md:text-[15px] text-gray-600 leading-relaxed">{a.descricao}</div>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>