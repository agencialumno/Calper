<script>
  import { page } from '$app/stores';

  let { data, children } = $props();

  const nav = [
    { href: '/admin/dashboard', label: 'Dashboard' },
    { href: '/admin/unidades', label: 'Unidades' },
    { href: '/admin/checkin', label: 'Check-in' },
    { href: '/admin/atualizacoes', label: 'Atualizações' }
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
  <nav class="md:hidden grid grid-cols-4 gap-2 px-4 py-3 bg-white border-b border-gray-100">
    {#each nav as item}
      {@const ativo = $page.url.pathname.startsWith(item.href)}
      <a
        href={item.href}
        class="flex items-center justify-center px-1.5 py-2.5 rounded-xl text-[12px] font-bold text-center transition-colors active:scale-95"
        class:bg-calper-red={ativo}
        class:text-white={ativo}
        class:bg-gray-100={!ativo}
        class:text-gray-500={!ativo}
      >
        {item.label}
      </a>
    {/each}
  </nav>

  <main class="flex-1 min-w-0">
    {@render children()}
  </main>
</div>