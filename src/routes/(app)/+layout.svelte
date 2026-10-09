<script>
  import { page } from '$app/stores';
  import NotificationBell from '$lib/components/NotificationBell.svelte';
  import UnitSwitcher from '$lib/components/UnitSwitcher.svelte';
  import UserMenu from '$lib/components/UserMenu.svelte';

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

<header class="border-b border-gray-100 bg-white md:sticky md:top-0 md:z-20">
  <div class="max-w-5xl mx-auto px-5 md:px-8 py-3.5 md:py-4 flex items-center justify-between gap-4 md:gap-6">
    <div class="flex items-center gap-3 md:gap-8 min-w-0">
      <img src="/logo.png" alt="Calper" class="h-6 shrink-0" />
      <div class="min-w-0 border-l border-gray-100 pl-3 md:pl-6">
        <UnitSwitcher unidade={data.unidade} unidades={data.unidades} />
      </div>

      <nav class="hidden md:flex items-center gap-1 ml-2">
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

    <div class="flex items-center gap-2 shrink-0">
      <NotificationBell notificacoes={data.notificacoes} />
      <UserMenu investidor={data.investidor} />
    </div>
  </div>

  <!-- navegação mobile: abas maiores e com ícone, mais fáceis de tocar -->
  <nav class="md:hidden flex items-stretch gap-2 px-5 pb-3">
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
