<script>
  import { enhance } from '$app/forms';

  /** @type {import('./$types').PageData} */
  export let data;
</script>

<svelte:head>
  <title>Selecione a unidade — Calper</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-gray-50 px-6 py-12">
  <div class="card w-full max-w-md p-7">
    <h1 class="text-xl font-bold text-calper-dark mb-1">Selecione a unidade</h1>
    <p class="text-sm text-gray-500 mb-6">
      Encontramos mais de uma unidade vinculada ao seu CPF
    </p>

    <div class="flex flex-col gap-2.5">
      {#each data.unidades as u (u.id)}
        <form method="POST" action="?/escolher" use:enhance>
          <input type="hidden" name="unidadeId" value={u.id} />
          <button
            type="submit"
            class="w-full flex items-center justify-between text-left border border-gray-200 rounded-xl px-4 py-3.5 hover:border-calper-red transition-colors"
          >
            <span>
              <span class="block text-sm font-bold text-calper-dark">
                Unidade {u.numero} — Bloco {u.bloco}
              </span>
              <span class="block text-xs text-gray-500 mt-0.5">{u.empreendimento}</span>
            </span>
            <span
              class="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-calper-dark shrink-0"
            >
              →
            </span>
          </button>
        </form>
      {/each}
    </div>
  </div>
</div>
