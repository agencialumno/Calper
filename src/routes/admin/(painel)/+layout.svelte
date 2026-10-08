<script>
  import { page } from '$app/stores';

  let { data, children } = $props();

  const nav = [
    {
      href: '/admin/dashboard',
      label: 'Dashboard',
      icon: 'M3 3v18h18M7 14l4-4 4 4 5-6'
    },
    {
      href: '/admin/unidades',
      label: 'Unidades',
      icon: 'M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6'
    },
    {
      href: '/admin/checkin',
      label: 'Check-in',
      icon: 'M3 7V3h4M17 3h4v4M21 17v4h-4M7 21H3v-4M7 12h.01M12 7v.01M17 12v.01M12 17v.01'
    },
    {
      href: '/admin/atualizacoes',
      label: 'Atualizações',
      icon: 'M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z'
    }
    // Agenda entra em um próximo módulo.
  ];

  const rotuloPerfil = { admin: 'Admin', gestao: 'Gestão', atendimento: 'Atendimento' };
</script>

<div class="min-h-screen flex flex-col md:flex-row bg-[#f6f6f7]">
  <!-- sidebar (desktop) / barra superior enxuta (mobile) -->
  <aside
    class="md:basis-[240px] md:min-w-[240px] md:h-screen md:sticky md:top-0 md:flex-col md:overflow-y-auto bg-calper-dark flex items-center md:items-stretch justify-between md:justify-start gap-1 px-4 md:px-4 py-3 md:py-6"
  >
    <div class="px-0 md:px-3 md:pb-7 shrink-0">
      <img src="/logo-branca.png" alt="Calper" class="h-5 md:h-6" />
    </div>

    <!-- navegação: só no desktop fica aqui na sidebar -->
    <nav class="hidden md:flex md:flex-col gap-1 flex-1">
      {#each nav as item}
        <a
          href={item.href}
          class="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap"
          class:bg-white={$page.url.pathname.startsWith(item.href)}
          class:text-calper-dark={$page.url.pathname.startsWith(item.href)}
          class:text-gray-400={!$page.url.pathname.startsWith(item.href)}
        >
          {item.label}
        </a>
      {/each}
    </nav>

    <!-- perfil + sair: completo no desktop -->
    <div class="hidden md:flex mt-auto items-center gap-2.5 px-3 pt-4 border-t border-white/10">
      <div
        class="w-8 h-8 rounded-full bg-calper-red text-white flex items-center justify-center text-xs font-bold shrink-0"
      >
        {data.funcionario.nome.slice(0, 2).toUpperCase()}
      </div>
      <div class="min-w-0">
        <div class="text-sm font-semibold text-white truncate">{data.funcionario.nome}</div>
        <div class="text-xs text-gray-400">
          Perfil: {rotuloPerfil[data.funcionario.perfil] ?? data.funcionario.perfil}
        </div>
      </div>
    </div>
    <form method="POST" action="/admin/logout" class="hidden md:block px-3">
      <button type="submit" class="text-xs font-semibold text-gray-400 hover:text-white mt-2"
        >Sair</button
      >
    </form>

    <!-- versão compacta pra mobile: avatar + sair, sem as abas -->
    <div class="md:hidden flex items-center gap-2.5">
      <div
        class="w-7 h-7 rounded-full bg-calper-red text-white flex items-center justify-center text-[10px] font-bold shrink-0"
      >
        {data.funcionario.nome.slice(0, 2).toUpperCase()}
      </div>
      <form method="POST" action="/admin/logout">
        <button type="submit" class="text-xs font-semibold text-gray-300 px-1">Sair</button>
      </form>
    </div>
  </aside>

  <!-- navegação mobile: fora do header escuro, bem visível logo acima do conteúdo -->
  <nav class="md:hidden flex items-stretch gap-2 px-4 py-3 bg-white border-b border-gray-100 overflow-x-auto">
    {#each nav as item}
      {@const ativo = $page.url.pathname.startsWith(item.href)}
      <a
        href={item.href}
        class="flex-1 min-w-[84px] flex flex-col items-center justify-center gap-1 px-2 py-2.5 rounded-xl text-[11.5px] font-bold transition-colors active:scale-95"
        class:bg-calper-red={ativo}
        class:text-white={ativo}
        class:bg-gray-100={!ativo}
        class:text-gray-500={!ativo}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d={item.icon} stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        {item.label}
      </a>
    {/each}
  </nav>

  <main class="flex-1 min-w-0">
    {@render children()}
  </main>
</div>