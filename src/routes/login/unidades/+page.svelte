<script>
  import { enhance } from '$app/forms';

  /** @type {import('./$types').PageData} */
  export let data;

  let escolhendoId = null;

  function aoEscolher(id) {
    return () => {
      escolhendoId = id;
      return async ({ update }) => {
        await update();
        escolhendoId = null;
      };
    };
  }
</script>

<svelte:head>
  <title>Selecione a unidade — Calper</title>
</svelte:head>

<div class="min-h-screen relative overflow-hidden flex items-center justify-center px-6 py-12">
  <!-- fundo degradê de marca -->
  <div
    class="absolute inset-0"
    style="background: linear-gradient(150deg, #282e35 0%, #2c333b 38%, #7a0c15 78%, #dd0417 130%)"
  ></div>
  <div
    class="absolute inset-0 opacity-25"
    style="background: radial-gradient(circle at 15% 15%, rgba(255,90,103,.55), transparent 55%), radial-gradient(circle at 85% 85%, rgba(255,255,255,.15), transparent 50%)"
  ></div>

  <div class="relative w-full max-w-md">
    <div class="flex justify-center mb-6">
      <img src="/logo-branca.png" alt="Calper" class="h-7" />
    </div>

    <div class="card w-full p-7 shadow-2xl">
      <h1 class="text-xl font-bold text-calper-dark mb-1">Selecione a unidade</h1>
      <p class="text-sm text-gray-500 mb-6">
        Encontramos mais de uma unidade vinculada ao seu CPF
      </p>

      <div class="flex flex-col gap-2.5">
        {#each data.unidades as u (u.id)}
          <form method="POST" action="?/escolher" use:enhance={aoEscolher(u.id)}>
            <input type="hidden" name="unidadeId" value={u.id} />
            <button
              type="submit"
              disabled={escolhendoId !== null}
              class="w-full flex items-center justify-between text-left border border-gray-200 rounded-xl px-4 py-3.5 transition-all hover:border-calper-red hover:shadow-md disabled:opacity-60 group"
            >
              <span class="flex items-center gap-3">
                <span
                  class="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-white text-xs font-extrabold"
                  style="background: linear-gradient(135deg, #ef2334, #b80311)"
                >
                  {u.bloco}
                </span>
                <span>
                  <span class="block text-sm font-bold text-calper-dark">
                    Unidade {u.numero} — Bloco {u.bloco}
                  </span>
                  <span class="block text-xs text-gray-500 mt-0.5">{u.empreendimento}</span>
                </span>
              </span>
              <span
                class="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-calper-dark shrink-0 transition-colors group-hover:bg-calper-red group-hover:text-white"
              >
                {#if escolhendoId === u.id}
                  <svg
                    class="w-3.5 h-3.5 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3"
                  >
                    <circle cx="12" cy="12" r="9" opacity="0.25" />
                    <path d="M21 12a9 9 0 00-9-9" stroke-linecap="round" />
                  </svg>
                {:else}
                  →
                {/if}
              </span>
            </button>
          </form>
        {/each}
      </div>
    </div>

    <p class="relative text-center text-xs text-gray-300 mt-6">
      © Calper — plataforma do investidor
    </p>
  </div>
</div>