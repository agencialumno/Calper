<script>
  import { page } from '$app/stores';

  /** @type {{ data: import('./$types').LayoutData, children: import('svelte').Snippet }} */
  let { data, children } = $props();

  const nav = [
    {
      href: '/painel',
      label: 'Painel',
      icon: 'M3 11l9-8 9 8M5 10v10h14V10'
    },
    {
      href: '/jornada',
      label: 'Jornada da obra',
      icon: 'M3 12h18M3 6h18M3 18h18'
    }
  ];
</script>

<header class="border-b border-gray-100 bg-white md:sticky md:top-0 md:z-10">
  <div class="max-w-5xl mx-auto px-5 md:px-8 py-4 md:py-5 flex items-center justify-between gap-6">
    <div class="flex items-center gap-3 md:gap-8 min-w-0">
      <img src="/logo.png" alt="Calper" class="h-6 md:h-6 shrink-0" />
      <div class="min-w-0 border-l border-gray-100 pl-3 md:pl-0 md:border-l-0">
        <div class="text-[11px] font-semibold text-gray-400 tracking-wide">UNIDADE</div>
        {#if data.unidade}
          <div class="text-base md:text-lg font-extrabold text-calper-dark truncate">
            Unidade {data.unidade.numero} — Bloco {data.unidade.bloco}
          </div>
        {/if}
      </div>

      <nav class="hidden md:flex items-center gap-1 ml-4">
        {#each nav as item}
          <a
            href={item.href}
            class="px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors"
            class:bg-gray-100={$page.url.pathname.startsWith(item.href)}
            class:text-calper-dark={$page.url.pathname.startsWith(item.href)}
            class:text-gray-500={!$page.url.pathname.startsWith(item.href)}
          >
            {item.label}
          </a>
        {/each}
      </nav>
    </div>

    <form method="POST" action="/logout" class="shrink-0">
      <button type="submit" class="text-sm font-semibold text-gray-500 hover:text-calper-red px-2 py-2"
        >Sair</button
      >
    </form>
  </div>

  <!-- navegação mobile: abas maiores e com ícone, mais fáceis de tocar -->
  <nav class="md:hidden flex items-stretch gap-2 px-4 pb-3 -mt-1">
    {#each nav as item}
      {@const ativo = $page.url.pathname.startsWith(item.href)}
      <a
        href={item.href}
        class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-[13px] font-bold transition-colors active:scale-95"
        class:bg-calper-red={ativo}
        class:text-white={ativo}
        class:bg-gray-100={!ativo}
        class:text-gray-500={!ativo}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d={item.icon} stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        {item.label}
      </a>
    {/each}
  </nav>
</header>

<main class="bg-[#f9f9fa] min-h-[calc(100vh-70px)]">
  {@render children()}
</main>