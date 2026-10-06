<script>
  let { data } = $props();

  function formatarData(iso) {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  }
</script>

<svelte:head>
  <title>Jornada — Calper</title>
</svelte:head>

<div class="p-5 max-w-lg mx-auto">
  <a href="/painel" class="text-sm text-gray-500 hover:text-calper-dark">← Painel</a>

  <div class="mt-3 mb-6">
    <h1 class="text-xl font-bold text-calper-dark">{data.empreendimento}</h1>
    <p class="text-sm text-gray-500 mt-0.5">Estágio atual: <span class="font-semibold text-calper-red">{data.estagioAtual}</span></p>
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
          <div class="pb-7 min-w-0">
            <div class="text-xs text-gray-400 mb-1">{formatarData(a.createdAt)}</div>
            <div class="card p-4">
              {#if a.midiaBase64}
                <img src={a.midiaBase64} alt={a.titulo} class="w-full rounded-lg mb-3 object-cover max-h-52" />
              {/if}
              <div class="font-bold text-calper-dark mb-1">{a.titulo}</div>
              <div class="text-sm text-gray-600 leading-relaxed">{a.descricao}</div>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>