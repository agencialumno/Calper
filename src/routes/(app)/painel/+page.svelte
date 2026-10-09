<script>
  import { page } from '$app/stores';
  import EtapasTimeline from '$lib/components/EtapasTimeline.svelte';
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
      Obrigado por responder a pesquisa! Sua opinião ajuda a melhorar a jornada.
    </div>
  {/if}

  {#if data.pesquisasPendentes.length > 0}
    <div class="rounded-2xl bg-[#fdeceb] border border-[#f5c9cb] p-4 md:p-5 flex items-center justify-between gap-4 flex-wrap">
      <div>
        <div class="text-sm font-bold text-calper-dark">Como foi sua visita?</div>
        <div class="text-xs text-gray-600 mt-0.5">
          {data.pesquisasPendentes.length === 1
            ? `Deixe sua avaliação sobre "${data.pesquisasPendentes[0].tipoNome}"`
            : `Você tem ${data.pesquisasPendentes.length} pesquisas de satisfação pendentes`}
        </div>
      </div>
      <a href={`/pesquisa/${data.pesquisasPendentes[0].id}`} class="btn-primary text-sm !py-2.5 shrink-0">
        Responder agora
      </a>
    </div>
  {/if}

  <!-- estágio da obra + linha do tempo -->
  <section class="card p-5 md:p-8">
    <div class="flex items-start justify-between gap-4 mb-6 md:mb-8">
      <div class="min-w-0">
        <div class="text-xs font-bold text-calper-red tracking-wide uppercase mb-1.5">Andamento do empreendimento</div>
        <h1 class="text-xl md:text-3xl font-extrabold text-calper-dark leading-tight">{data.empreendimento}</h1>
        <p class="text-sm md:text-base text-gray-500 mt-1">Último marco: {data.estagioAtual}</p>
      </div>
      <a href="/jornada" class="text-sm font-semibold text-calper-red hover:underline shrink-0 mt-1">
        ver jornada →
      </a>
    </div>
    <EtapasTimeline etapa={data.etapa} detalhado />
  </section>

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