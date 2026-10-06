<script>
  /** @type {import('./$types').LayoutData} */
  export let data;
  let { children } = $props();
</script>

<header class="border-b border-gray-100 px-5 py-4 flex items-center justify-between">
  <div>
    <div class="text-[11px] font-semibold text-gray-400 tracking-wide">UNIDADE</div>
    {#if data.unidade}
      <div class="text-lg font-extrabold text-calper-dark">
        Unidade {data.unidade.numero} — Bloco {data.unidade.bloco}
      </div>
    {/if}
  </div>
  <form method="POST" action="/logout">
    <button type="submit" class="text-sm font-semibold text-gray-500 hover:text-calper-red"
      >Sair</button
    >
  </form>
</header>

<main>
  {@render children()}
</main>
