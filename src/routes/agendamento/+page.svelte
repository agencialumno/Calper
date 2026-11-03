<svelte:head>
  <title>Agendar — Calper</title>
</svelte:head>

<div class="max-w-xl mx-auto p-5 md:p-10">
  <img src="/logo.png" alt="Calper" class="h-14 w-auto mb-6" />
  <h1 class="text-xl md:text-2xl font-bold text-calper-dark mb-1">Murano Residencial</h1>
  <p class="text-sm text-gray-500 mb-6">Por favor, selecione a opção que deseja</p>

  <div class="card p-6 md:p-8 flex flex-col gap-4">
    <a href="/agendar-entrega-chaves" class="btn-primary w-full text-center" data-testid="escolha-entrega">Agendar entrega de chaves</a>
    <a href="/agendar-vistoria" class="btn-primary w-full text-center" data-testid="escolha-vistoria">Agendar vistoria</a>
  </div>
</div>
