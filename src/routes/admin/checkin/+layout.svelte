<script>
  import { onMount } from 'svelte';

  let { data, children } = $props();

  const rotuloPerfil = { admin: 'Admin', gestao: 'Gestão', atendimento: 'Atendimento' };

  // null = ainda não checado (evita piscar o conteúdo no desktop)
  let dispositivoPermitido = $state(null);

  // O check-in usa a câmera para ler QR Code, então só faz sentido em
  // aparelho de toque (celular/tablet). Desktop com mouse fica bloqueado.
  onMount(() => {
    const consulta = window.matchMedia('(pointer: coarse)');
    dispositivoPermitido = consulta.matches;
    const aoMudar = (e) => (dispositivoPermitido = e.matches);
    consulta.addEventListener('change', aoMudar);
    return () => consulta.removeEventListener('change', aoMudar);
  });
</script>

<div class="min-h-screen bg-[#f6f6f7]">
  <header class="bg-calper-dark px-5 py-4 flex items-center justify-between gap-4">
    <div class="flex items-center gap-4">
      <img src="/logo-branca.png" alt="Calper" class="h-6" />
      <span class="text-sm font-semibold text-gray-300 hidden sm:inline">Check-in</span>
    </div>
    <div class="flex items-center gap-4">
      <span class="text-xs text-gray-400 hidden sm:inline">
        {data.funcionario.nome} · {rotuloPerfil[data.funcionario.perfil] ?? data.funcionario.perfil}
      </span>
      <form method="POST" action="/admin/logout">
        <button type="submit" class="text-sm font-semibold text-gray-300 hover:text-white">Sair</button>
      </form>
    </div>
  </header>

  {#if dispositivoPermitido === true}
    {@render children()}
  {:else if dispositivoPermitido === false}
    <div class="max-w-md mx-auto px-6 py-16 text-center">
      <div class="w-14 h-14 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center mx-auto mb-5">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="7" y="2" width="10" height="20" rx="2" />
          <path d="M11 18h2" stroke-linecap="round" />
        </svg>
      </div>
      <h1 class="text-xl font-extrabold text-calper-dark mb-2">Check-in disponível só no celular</h1>
      <p class="text-base text-gray-600 leading-relaxed mb-7">
        O check-in usa a câmera para ler o QR Code do investidor. Abra esta página no celular ou tablet.
      </p>
      <a href="/admin/dashboard" class="btn-outline inline-block text-sm">Voltar ao painel</a>
    </div>
  {/if}
</div>
