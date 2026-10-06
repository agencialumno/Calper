<script>
  let { data, children } = $props();

  const rotuloPerfil = { admin: 'Admin', gestao: 'Gestão', atendimento: 'Atendimento' };
</script>

<div class="min-h-screen bg-[#f6f6f7]">
  <header class="bg-calper-dark px-5 py-3.5 flex items-center justify-between">
    <div class="flex items-center gap-4">
      <img src="/logo-branca.png" alt="Calper" class="h-6" />
      <span class="text-xs text-gray-400 hidden sm:inline">Check-in</span>
    </div>
    <div class="flex items-center gap-3">
      <span class="text-xs text-gray-400">
        {data.funcionario.nome} · {rotuloPerfil[data.funcionario.perfil] ?? data.funcionario.perfil}
      </span>
      <form method="POST" action="/admin/logout">
        <button type="submit" class="text-xs font-semibold text-gray-300 hover:text-white">Sair</button>
      </form>
    </div>
  </header>

  {@render children()}
</div>