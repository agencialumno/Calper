<script>
  import { applyAction, enhance } from '$app/forms';

  // Botão "Iniciar atendimento" de uma unidade (aba Unidades e dossiê). `atendimento` vem do servidor:
  //  { acao: 'iniciar' }  → cria o atendimento direto (sem agendamento prévio) e abre o fluxo;
  //  { acao: 'abrir', agendamentoId } → a unidade já tem agendamento de entrega de chaves: abre o existente;
  //  { acao: 'bloqueada', motivo } → unidade fora do agendamento: não inicia, mostra o motivo.
  let { unidadeId, atendimento, class: classe = '' } = $props();

  let enviando = $state(false);
  let erro = $state('');

  // o formulário envia para a rota de entrega de chaves (onde o colaborador também pode gravar)
  function aoEnviar() {
    enviando = true;
    erro = '';
    return async ({ result }) => {
      if (result.type === 'failure') {
        erro = result.data?.erro ?? 'Não foi possível iniciar o atendimento.';
        enviando = false;
      } else {
        await applyAction(result); // redirect para o atendimento
      }
    };
  }
</script>

<div class="flex flex-col items-start gap-1 {classe}" data-testid="iniciar-atendimento">
  {#if atendimento.acao === 'iniciar'}
    <form method="POST" action="/admin/entrega-chaves?/iniciarDireto" use:enhance={aoEnviar}>
      <input type="hidden" name="unidadeId" value={unidadeId} />
      <button
        type="submit"
        disabled={enviando}
        class="text-xs font-bold text-white bg-calper-red px-3 py-1.5 rounded-lg disabled:opacity-60"
      >
        {enviando ? 'Abrindo…' : 'Iniciar atendimento'}
      </button>
    </form>
  {:else if atendimento.acao === 'abrir'}
    <a
      href="/admin/entrega-chaves/{atendimento.agendamentoId}"
      class="text-xs font-bold text-calper-red border border-calper-red/40 px-3 py-1.5 rounded-lg"
    >
      Abrir atendimento
    </a>
  {:else}
    <span class="text-xs font-semibold text-gray-500" data-testid="atendimento-bloqueado">
      Atendimento indisponível: {atendimento.motivo}
    </span>
  {/if}
  {#if erro}
    <span class="text-xs font-semibold text-red-600" role="alert">{erro}</span>
  {/if}
</div>
