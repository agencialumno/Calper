<script>
  import { onMount } from 'svelte';
  import {
    LIMITE_ARQUIVO_BYTES,
    LIMITE_TOTAL_BYTES,
    mensagemArquivoGrande,
    mensagemTotalGrande
  } from '$lib/uploadLimite.js';

  // Guarda global de upload: vale para todo formulário com <input type="file">, inclusive os futuros.
  // 1) ao escolher um arquivo grande demais, descarta a seleção e avisa na hora;
  // 2) ao enviar, bloqueia o envio se a soma dos arquivos passa do limite da plataforma.
  let mensagem = $state('');

  onMount(() => {
    function aoEscolher(e) {
      const input = e.target;
      if (!(input instanceof HTMLInputElement) || input.type !== 'file') return;
      const grande = [...(input.files ?? [])].find((f) => f.size > LIMITE_ARQUIVO_BYTES);
      if (grande) {
        input.value = '';
        mensagem = mensagemArquivoGrande(grande);
        // o handler do próprio campo não deve tratar a seleção descartada
        e.stopImmediatePropagation();
      }
    }

    function aoEnviar(e) {
      const form = e.target;
      if (!(form instanceof HTMLFormElement)) return;
      let total = 0;
      for (const valor of new FormData(form, e.submitter).values()) {
        if (valor instanceof File) total += valor.size;
      }
      if (total > LIMITE_TOTAL_BYTES) {
        e.preventDefault();
        e.stopImmediatePropagation();
        mensagem = mensagemTotalGrande(total);
      }
    }

    // captura no document: roda antes dos handlers do campo e do use:enhance
    document.addEventListener('change', aoEscolher, true);
    document.addEventListener('submit', aoEnviar, true);
    return () => {
      document.removeEventListener('change', aoEscolher, true);
      document.removeEventListener('submit', aoEnviar, true);
    };
  });
</script>

{#if mensagem}
  <div class="fixed inset-x-0 top-0 z-[100] p-4 flex justify-center pointer-events-none">
    <div
      role="alert"
      class="pointer-events-auto w-full max-w-lg bg-white border border-red-200 shadow-xl rounded-2xl p-4 flex items-start gap-3"
    >
      <div class="text-sm text-red-800 leading-relaxed flex-1">{mensagem}</div>
      <button
        type="button"
        class="text-sm font-bold text-calper-red shrink-0 px-2 py-1"
        onclick={() => (mensagem = '')}
      >
        Entendi
      </button>
    </div>
  </div>
{/if}
