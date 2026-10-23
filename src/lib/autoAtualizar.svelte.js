import { onMount } from 'svelte';
import { invalidateAll } from '$app/navigation';

/**
 * Mantém a página atualizada sem F5 (polling leve): a cada `intervalo` recarrega os dados da página
 * (`invalidateAll`), então novo agendamento, cancelamento, check-in e mudança de status aparecem sozinhos.
 * Não atualiza enquanto: a aba está escondida, a pessoa está digitando/escolhendo em algum campo (para não
 * atrapalhar nem perder o que está sendo preenchido) ou já há uma atualização em andamento.
 * Chame uma vez, durante a inicialização do componente. Devolve { em } (Date da última atualização).
 */
export function autoAtualizar({ intervalo = 20000 } = {}) {
  const estado = $state({ em: new Date(), ativo: true });

  onMount(() => {
    let emAndamento = false;
    let ultimoInput = 0; // quando alguém mexeu num campo pela última vez

    const camposEmUso = () => {
      const el = document.activeElement;
      return el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
    };
    // quem mexeu num campo há pouco (mesmo sem foco agora): não atualiza por cima; depois de 1 minuto parado, volta a atualizar
    const aoDigitar = (e) => {
      if (e.target?.matches?.('input, textarea, select')) ultimoInput = Date.now();
    };
    const aoEnviar = () => (ultimoInput = 0);
    const digitando = () => Date.now() - ultimoInput < 60_000;

    async function atualizar() {
      if (emAndamento || document.hidden || digitando() || camposEmUso()) return;
      emAndamento = true;
      try {
        await invalidateAll();
        estado.em = new Date();
      } catch {
        // sem rede/servidor fora do ar: tenta de novo no próximo ciclo
      } finally {
        emAndamento = false;
      }
    }

    const timer = setInterval(atualizar, intervalo);
    // ao voltar para a aba, atualiza logo
    const aoVoltar = () => !document.hidden && atualizar();
    document.addEventListener('visibilitychange', aoVoltar);
    document.addEventListener('input', aoDigitar, true);
    document.addEventListener('submit', aoEnviar, true);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', aoVoltar);
      document.removeEventListener('input', aoDigitar, true);
      document.removeEventListener('submit', aoEnviar, true);
    };
  });

  return estado;
}
