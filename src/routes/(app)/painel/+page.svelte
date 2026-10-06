<script>
  let { data } = $props();

  const statusEstilo = {
    confirmado: { texto: 'Confirmado', bg: 'bg-green-50', fg: 'text-green-700' },
    cancelado: { texto: 'Cancelado', bg: 'bg-gray-100', fg: 'text-gray-500' },
    realizado: { texto: 'Realizado', bg: 'bg-blue-50', fg: 'text-blue-700' }
  };

  function formatarDataHora(iso) {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
</script>

<svelte:head>
  <title>Painel — Calper</title>
</svelte:head>

<div class="p-5 max-w-2xl mx-auto flex flex-col gap-6">

    <!-- estágio da obra -->
  <a
    href="/jornada"
    class="rounded-2xl p-5 text-white flex items-center justify-between"
    style="background: linear-gradient(135deg, #2c333b, #20252b)"
  >
    <div>
      <div class="text-[11px] font-bold text-red-300 tracking-wide mb-1">ESTÁGIO ATUAL DA OBRA</div>
      <div class="text-lg font-bold">{data.estagioAtual}</div>
      <div class="text-xs text-gray-400 mt-0.5">{data.empreendimento}</div>
    </div>
    <span class="text-xs font-semibold text-white shrink-0">ver jornada →</span>
  </a>

  <!-- agendamentos existentes -->
  <div>
    <h2 class="text-sm font-bold text-calper-dark mb-3">Meus agendamentos</h2>
    {#if data.agendamentos.length === 0}
      <p class="text-sm text-gray-400">Nenhum agendamento ainda.</p>
    {:else}
      <div class="flex flex-col gap-2.5">
        {#each data.agendamentos as a (a.id)}
          <a
            href={`/agendamentos/${a.id}`}
            class="card p-4 flex items-center justify-between hover:border-calper-red"
          >
            <div>
              <div class="text-sm font-bold text-calper-dark">{a.tipoNome}</div>
              <div class="text-xs text-gray-500 mt-0.5">{formatarDataHora(a.dataHora)}</div>
            </div>
            <span
              class="text-xs font-bold px-2.5 py-1 rounded-full {statusEstilo[a.status]?.bg} {statusEstilo[a.status]
                ?.fg}"
            >
              {statusEstilo[a.status]?.texto ?? a.status}
            </span>
          </a>
        {/each}
      </div>
    {/if}
  </div>

  <!-- novo agendamento -->
  <div>
    <h2 class="text-sm font-bold text-calper-dark mb-3">Agendar</h2>
    <div class="flex flex-col gap-2.5">
      {#each data.tipos as t (t.slug)}
        {#if t.bloqueado}
          <div class="card p-4 flex items-center justify-between opacity-60">
            <div>
              <div class="text-sm font-bold text-calper-dark">{t.nome}</div>
              <div class="text-xs text-gray-500 mt-0.5">já agendado para esta unidade</div>
            </div>
            <span class="text-xs font-semibold text-gray-400">indisponível</span>
          </div>
        {:else}
          <a href={`/agendar/${t.slug}`} class="card p-4 flex items-center justify-between hover:border-calper-red">
            <div>
              <div class="text-sm font-bold text-calper-dark">{t.nome}</div>
              {#if t.exigeDocumento}
                <div class="text-xs text-gray-500 mt-0.5">documento de identificação obrigatório</div>
              {/if}
            </div>
            <span class="text-xs font-semibold text-calper-red">agendar →</span>
          </a>
        {/if}
      {/each}
    </div>
  </div>
</div>
