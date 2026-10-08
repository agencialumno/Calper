<script>
  let { aberto = $bindable(false) } = $props();

  const passos = [
    {
      titulo: 'Bem-vindo ao Calper',
      texto:
        'Esse é o seu painel — daqui você acompanha tudo sobre a sua unidade, do andamento da obra até seus agendamentos. Leva menos de um minuto pra conhecer.',
      icone:
        'M3 11l9-8 9 8M5 10v10h14V10'
    },
    {
      titulo: 'Jornada da obra',
      texto:
        'No card escuro do topo você vê o estágio atual da obra. Clique nele (ou na aba "Jornada da obra") pra ver a linha do tempo completa, com fotos e novidades de cada etapa.',
      icone:
        'M3 12h18M3 6h18M3 18h18'
    },
    {
      titulo: 'Agendar visitas',
      texto:
        'Na seção "Agendar" você marca visita à obra, vistoria da unidade, assinatura de escritura, entrega de chaves ou atendimento presencial — cada tipo com suas próprias regras de documento e horário.',
      icone:
        'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'
    },
    {
      titulo: 'Seus agendamentos e QR Code',
      texto:
        'Em "Meus agendamentos" você acompanha o status de cada marcação e encontra o QR Code pra apresentar no dia — é só mostrar na recepção pra agilizar o check-in.',
      icone:
        'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
    },
    {
      titulo: 'Notificações',
      texto:
        'O sino no topo avisa sobre confirmações, lembretes de visita e novidades da obra — tanto por aqui quanto por e-mail.',
      icone:
        'M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9'
    },
    {
      titulo: 'Pesquisa de satisfação',
      texto:
        'Depois de cada visita realizada, a gente pede uma avaliação rápida — leva menos de um minuto e ajuda a melhorar a experiência da Calper.',
      icone:
        'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
    }
  ];

  let passoAtual = $state(0);
  const ultimoPasso = $derived(passoAtual === passos.length - 1);

  // marca como visto assim que o tutorial abre — pular ou terminar dão no
  // mesmo resultado prático (não precisa reaparecer), e isso evita que ele
  // fique "preso" aparecendo pra sempre se a pessoa fechar a aba no meio
  $effect(() => {
    if (aberto) {
      fetch('/api/tutorial/concluir', { method: 'POST' }).catch(() => {
        // best-effort — não bloqueia a experiência se a chamada falhar
      });
    }
  });

  function fechar() {
    aberto = false;
  }

  function proximo() {
    if (ultimoPasso) {
      fechar();
    } else {
      passoAtual++;
    }
  }

  function voltar() {
    if (passoAtual > 0) passoAtual--;
  }
</script>

{#if aberto}
  <div class="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center p-0 md:p-6">
    <div class="bg-white w-full md:max-w-md rounded-t-3xl md:rounded-3xl p-6 md:p-8 relative">
      <button
        type="button"
        onclick={fechar}
        class="absolute top-4 right-4 text-xs font-semibold text-gray-400 hover:text-gray-600"
      >
        Pular
      </button>

      <div
        class="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
        style="background: linear-gradient(135deg, #ef2334, #b80311)"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
          <path d={passos[passoAtual].icone} stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>

      <h2 class="text-lg font-bold text-calper-dark mb-2">{passos[passoAtual].titulo}</h2>
      <p class="text-sm text-gray-500 leading-relaxed mb-6">{passos[passoAtual].texto}</p>

      <div class="flex items-center justify-between gap-4">
        <div class="flex gap-1.5">
          {#each passos as _, i}
            <span
              class="h-1.5 rounded-full transition-all"
              class:w-5={i === passoAtual}
              class:w-1.5={i !== passoAtual}
              class:bg-calper-red={i === passoAtual}
              class:bg-gray-200={i !== passoAtual}
            ></span>
          {/each}
        </div>

        <div class="flex items-center gap-3 shrink-0">
          {#if passoAtual > 0}
            <button type="button" onclick={voltar} class="text-sm font-semibold text-gray-400 px-2 py-2">
              Voltar
            </button>
          {/if}
          <button
            type="button"
            onclick={proximo}
            class="text-sm font-bold text-white px-5 py-2.5 rounded-full"
            style="background: linear-gradient(135deg, #ef2334, #b80311)"
          >
            {ultimoPasso ? 'Começar a usar' : 'Próximo'}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}