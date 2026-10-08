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

<div class="max-w-5xl mx-auto p-5 md:p-10">
  {#if mostrarObrigado}
    <div class="bg-green-50 border border-green-100 text-green-700 text-sm rounded-xl px-4 py-3 mb-6">
      Obrigado por responder a pesquisa! Sua opinião ajuda a melhorar a jornada.
    </div>
  {/if}

  {#if data.pesquisasPendentes.length > 0}
    <div class="rounded-2xl bg-[#fdeceb] border border-[#f5c9cb] p-4 md:p-5 mb-6 flex items-center justify-between gap-4 flex-wrap">
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

  <!-- estágio da obra -->
  <a
    href="/jornada"
    class="rounded-2xl p-5 md:p-7 text-white flex items-center justify-between mb-6 md:mb-10"
    style="background: linear-gradient(135deg, #2c333b, #20252b)"
  >
    <div>
      <div class="text-[11px] font-bold text-red-300 tracking-wide mb-1">ESTÁGIO ATUAL DA OBRA</div>
      <div class="text-lg md:text-2xl font-bold">{data.estagioAtual}</div>
      <div class="text-xs md:text-sm text-gray-400 mt-0.5">{data.empreendimento}</div>
    </div>
    <span class="text-xs md:text-sm font-semibold text-white shrink-0">ver jornada →</span>
  </a>

  <div class="grid grid-cols-1 md:grid-cols-[1.1fr_1.4fr] gap-6 md:gap-8">
    <!-- agendamentos existentes -->
    <div>
      <h2 class="text-sm font-bold text-calper-dark mb-3 md:mb-4 md:text-base">Meus agendamentos</h2>
      {#if data.agendamentos.length === 0}
        <p class="text-sm text-gray-400">Nenhum agendamento ainda.</p>
      {:else}
        <div class="flex flex-col gap-2.5">
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
      <h2 class="text-sm font-bold text-calper-dark mb-3 md:mb-4 md:text-base">Agendar</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {#each data.tipos as t (t.slug)}
          {#if t.bloqueado}
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