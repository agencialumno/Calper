<script>
  import { page } from '$app/stores';
  import TutorialOnboarding from '$lib/components/TutorialOnboarding.svelte';

  let { data } = $props();
  let tutorialAberto = $state(data.mostrarTutorial);

  const statusEstilo = {
    confirmado: { texto: 'Confirmado', bg: 'bg-green-50', fg: 'text-green-700' },
    cancelado: { texto: 'Cancelado', bg: 'bg-gray-100', fg: 'text-gray-500' },
    realizado: { texto: 'Realizado', bg: 'bg-blue-50', fg: 'text-blue-700' }
  };

  function formatarDataHora(iso) {
    return new Date(iso).toLocaleString('pt-BR', {
      timeZone: 'UTC',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  const mostrarObrigado = $derived($page.url.searchParams.get('pesquisa') === 'obrigado');
</script>

<svelte:head>
  <title>Painel — Calper</title>
</svelte:head>

<TutorialOnboarding bind:aberto={tutorialAberto} />

<div class="max-w-5xl mx-auto px-5 md:px-8 py-6 md:py-10 flex flex-col gap-6 md:gap-10">
  {#if mostrarObrigado}
    <div class="bg-green-50 border border-green-100 text-green-700 text-sm rounded-xl px-4 py-3">
      Obrigado por responder ao questionário de encerramento! Sua opinião ajuda a melhorar a jornada.
    </div>
  {/if}

  {#if data.pesquisasPendentes.length > 0}
    <div
      class="rounded-2xl p-5 md:p-7 flex items-center justify-between gap-5 flex-wrap text-white shadow-lg"
      style="background: linear-gradient(135deg, #ef2334, #b80311)"
    >
      <div class="flex items-start gap-4 min-w-0">
        <div class="w-12 h-12 md:w-14 md:h-14 rounded-full bg-white/20 flex items-center justify-center shrink-0">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
          </svg>
        </div>
        <div class="min-w-0">
          <div class="text-lg md:text-xl font-extrabold leading-tight">
            {data.pesquisasPendentes.length === 1
              ? 'Você tem 1 questionário de encerramento pendente'
              : `Você tem ${data.pesquisasPendentes.length} questionários de encerramento pendentes`}
          </div>
          <div class="text-sm text-white/90 mt-1">
            {data.pesquisasPendentes.length === 1
              ? `Como foi "${data.pesquisasPendentes[0].tipoNome}"? Leva menos de um minuto.`
              : `Responda um por vez — o primeiro é sobre "${data.pesquisasPendentes[0].tipoNome}". Leva menos de um minuto cada.`}
          </div>
        </div>
      </div>
      <a
        href={`/pesquisa/${data.pesquisasPendentes[0].id}`}
        class="bg-white text-calper-red font-bold text-sm md:text-base rounded-xl px-5 py-3 shrink-0 hover:bg-gray-50 active:scale-95 transition"
      >
        Responder questionário de encerramento
      </a>
    </div>
  {/if}

  <!-- banner do empreendimento + progresso da obra -->
  <a
    href="/jornada"
    class="relative block overflow-hidden rounded-2xl text-white shadow-md hover:shadow-lg transition-shadow min-h-[200px] md:min-h-[260px]"
    style="background: #282e35"
  >
    {#if data.temBanner}
      <img src="/banner" alt="" class="absolute inset-0 w-full h-full object-cover" />
    {/if}
    <div
      class="absolute inset-0"
      style="background: linear-gradient(165deg, rgba(40,46,53,.88) 10%, rgba(40,46,53,.55) 60%, rgba(40,46,53,.8) 100%)"
    ></div>

    <div class="relative p-5 md:p-8 h-full min-h-[200px] md:min-h-[260px] flex flex-col justify-between gap-8">
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0">
          <div class="text-xs font-bold tracking-wide uppercase text-white/70 mb-1.5">Andamento do empreendimento</div>
          <h1 class="text-2xl md:text-4xl font-extrabold leading-tight">{data.empreendimento}</h1>
        </div>
        <span class="text-sm font-semibold text-white/90 shrink-0 mt-1">conheça sua jornada →</span>
      </div>

      <div>
        <div
          class="h-3 md:h-4 rounded-full bg-white/25 overflow-hidden"
          role="progressbar"
          aria-label="Progresso da obra"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={data.progresso}
        >
          <div
            class="h-full rounded-full bg-calper-red transition-all"
            style="width: {Math.min(100, Math.max(0, data.progresso))}%"
          ></div>
        </div>
      </div>
    </div>
  </a>

  <div class="grid grid-cols-1 md:grid-cols-[1.1fr_1.4fr] gap-8 md:gap-10 items-start">
    <!-- agendamentos existentes -->
    <div>
      <h2 class="text-lg md:text-xl font-bold text-calper-dark mb-4">Meus agendamentos</h2>
      {#if data.agendamentos.length === 0}
        <p class="text-sm md:text-base text-gray-500">Nenhum agendamento ainda.</p>
      {:else}
        <div class="flex flex-col gap-3">
          {#each data.agendamentos as a (a.id)}
            <a
              href={`/agendamentos/${a.id}`}
              class="card p-4 md:p-5 flex items-center justify-between hover:border-calper-red hover:shadow-sm transition-shadow"
            >
              <div>
                <div class="text-sm md:text-[15px] font-bold text-calper-dark">{a.tipoNome}</div>
                <div class="text-xs md:text-sm text-gray-500 mt-0.5">{formatarDataHora(a.dataHora)}</div>
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
      <h2 class="text-lg md:text-xl font-bold text-calper-dark mb-4">Agendar</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {#each data.tipos as t (t.slug)}
          {#if t.foraDaEtapa}
            <div class="card p-4 md:p-5 bg-gray-50 flex flex-col gap-1" aria-disabled="true">
              <div class="text-sm md:text-[15px] font-bold text-gray-400">{t.nome}</div>
              <div class="text-xs text-gray-400">{t.motivoEtapa}</div>
            </div>
          {:else if t.bloqueado}
            <div class="card p-4 md:p-5 flex items-center justify-between opacity-60">
              <div>
                <div class="text-sm md:text-[15px] font-bold text-calper-dark">{t.nome}</div>
                <div class="text-xs text-gray-500 mt-0.5">já agendado</div>
              </div>
              <span class="text-xs font-semibold text-gray-400 shrink-0">indisponível</span>
            </div>
          {:else}
            <a
              href={`/agendar/${t.slug}`}
              class="card p-4 md:p-5 flex items-center justify-between gap-3 hover:border-calper-red hover:shadow-sm active:scale-[0.98] transition-all"
            >
              <div class="min-w-0">
                <div class="text-sm md:text-[15px] font-bold text-calper-dark">{t.nome}</div>
                {#if t.exigeDocumento}
                  <div class="text-xs text-gray-500 mt-0.5">documento obrigatório</div>
                {/if}
              </div>
              <span
                class="text-xs font-bold text-white px-3.5 py-2 rounded-full shrink-0"
                style="background: linear-gradient(135deg, #ef2334, #b80311)"
              >
                agendar
              </span>
            </a>
          {/if}
        {/each}
      </div>
    </div>
  </div>
</div>