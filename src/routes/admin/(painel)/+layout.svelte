<script>
  import { page } from '$app/stores';

  let { data, children } = $props();

  const nav = [
  { href: '/admin/unidades', label: 'Unidades' },
  { href: '/admin/checkin', label: 'Check-in' }
  // Dashboard, Agenda e Atualizações da obra entram nos próximos módulos.
];

  const rotuloPerfil = { admin: 'Admin', gestao: 'Gestão', atendimento: 'Atendimento' };
</script>

<div class="min-h-screen flex flex-wrap bg-[#f6f6f7]">
  <aside class="basis-[240px] min-w-[240px] bg-calper-dark px-4 py-6 flex flex-col gap-1 min-h-screen">
    <div class="px-3 pb-7">
      <img src="/logo-branca.png" alt="Calper" class="h-6" />
    </div>

    {#each nav as item}
      <a
        href={item.href}
        class="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold"
        class:bg-white={$page.url.pathname.startsWith(item.href)}
        class:text-calper-dark={$page.url.pathname.startsWith(item.href)}
        class:text-gray-400={!$page.url.pathname.startsWith(item.href)}
      >
        {item.label}
      </a>
    {/each}

    <div class="mt-auto flex items-center gap-2.5 px-3 pt-4 border-t border-white/10">
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
    <form method="POST" action="/admin/logout" class="px-3">
      <button type="submit" class="text-xs font-semibold text-gray-400 hover:text-white mt-2"
        >Sair</button
      >
    </form>
  </aside>

  <main class="flex-1 min-w-[320px]">
    {@render children()}
  </main>
</div>
