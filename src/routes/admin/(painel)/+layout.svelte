<script>
  import { page } from '$app/stores';

  let { data, children } = $props();

  const nav = [
  { href: '/admin/unidades', label: 'Unidades' },
  { href: '/admin/checkin', label: 'Check-in' },
  { href: '/admin/atualizacoes', label: 'Atualizações' }
  // Dashboard e Agenda entram nos próximos módulos.
];
  const rotuloPerfil = { admin: 'Admin', gestao: 'Gestão', atendimento: 'Atendimento' };
</script>

<div class="min-h-screen flex flex-col md:flex-row bg-[#f6f6f7]">
  <!-- sidebar (desktop) / barra superior (mobile) -->
  <aside
    class="md:basis-[240px] md:min-w-[240px] md:min-h-screen md:flex-col bg-calper-dark flex items-center md:items-stretch gap-1 px-3 md:px-4 py-2.5 md:py-6"
  >
    <div class="px-2 md:px-3 md:pb-7 shrink-0">
      <img src="/logo-branca.png" alt="Calper" class="h-5 md:h-6" />
    </div>

    <nav class="flex md:flex-col gap-1 overflow-x-auto flex-1 md:flex-none">
      {#each nav as item}
        <a
          href={item.href}
          class="flex items-center gap-3 px-3.5 md:px-4 py-2 md:py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap shrink-0"
          class:bg-white={$page.url.pathname.startsWith(item.href)}
          class:text-calper-dark={$page.url.pathname.startsWith(item.href)}
          class:text-gray-400={!$page.url.pathname.startsWith(item.href)}
        >
          {item.label}
        </a>
      {/each}
    </nav>

    <!-- perfil + sair: só aparece completo no desktop; no mobile vira um avatar com logout -->
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

    <!-- versão compacta pra mobile: só um botão de sair -->
    <form method="POST" action="/admin/logout" class="md:hidden shrink-0">
      <button type="submit" class="text-xs font-semibold text-gray-300 px-2">Sair</button>
    </form>
  </aside>

  <main class="flex-1 min-w-0">
    {@render children()}
  </main>
</div>