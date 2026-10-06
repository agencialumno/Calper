<script>
  import { page } from '$app/stores';

  /** @type {{ data: import('./$types').LayoutData, children: import('svelte').Snippet }} */
  let { data, children } = $props();

  const nav = [
    { href: '/painel', label: 'Painel' },
    { href: '/jornada', label: 'Jornada da obra' }
  ];
</script>

<header class="border-b border-gray-100 bg-white md:sticky md:top-0 md:z-10">
  <div class="max-w-5xl mx-auto px-5 md:px-8 py-4 md:py-5 flex items-center justify-between gap-6">
    <div class="flex items-center gap-8 min-w-0">
      <img src="/logo.png" alt="Calper" class="h-6 hidden md:block shrink-0" />
      <div class="min-w-0">
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
      <button type="submit" class="text-sm font-semibold text-gray-500 hover:text-calper-red"
        >Sair</button
      >
    </form>
  </div>

  <!-- navegação mobile: linha extra embaixo do header -->
  <nav class="md:hidden flex items-center gap-1 px-5 pb-3 -mt-1">
    {#each nav as item}
      <a
        href={item.href}
        class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
        class:bg-gray-100={$page.url.pathname.startsWith(item.href)}
        class:text-calper-dark={$page.url.pathname.startsWith(item.href)}
        class:text-gray-500={!$page.url.pathname.startsWith(item.href)}
      >
        {item.label}
      </a>
    {/each}
  </nav>
</header>

<main class="bg-[#f9f9fa] min-h-[calc(100vh-70px)]">
  {@render children()}
</main>