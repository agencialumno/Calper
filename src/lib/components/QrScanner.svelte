<script>
  import { onDestroy } from 'svelte';
  import jsQR from 'jsqr';

  let { onDetected } = $props();

  let video;
  let canvas;
  let streamAtivo = $state(false);
  let erro = $state('');
  let frameId;
  let mediaStream;

  async function iniciar() {
    erro = '';
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      video.srcObject = mediaStream;
      // iOS Safari exige que o play() aconteça dentro do gesto do usuário — este
      // método já é chamado a partir do onclick do botão, então está ok aqui.
      await video.play();
      streamAtivo = true;
      frameId = requestAnimationFrame(lerFrame);
    } catch {
      erro = 'Não foi possível acessar a câmera. Confira a permissão do navegador.';
    }
  }

  function lerFrame() {
    if (!streamAtivo) return;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imagem = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const resultado = jsQR(imagem.data, imagem.width, imagem.height, {
        inversionAttempts: 'dontInvert'
      });

      if (resultado?.data) {
        const valor = resultado.data;
        parar();
        onDetected?.(valor);
        return;
      }
    }

    frameId = requestAnimationFrame(lerFrame);
  }

  function parar() {
    cancelAnimationFrame(frameId);
    mediaStream?.getTracks().forEach((t) => t.stop());
    streamAtivo = false;
  }

  onDestroy(parar);
</script>

<div class="rounded-2xl overflow-hidden bg-calper-dark relative" style="aspect-ratio: 1 / 1;">
  <!-- svelte-ignore a11y_media_has_caption -->
  <video
    bind:this={video}
    class="w-full h-full object-cover {streamAtivo ? '' : 'hidden'}"
    muted
    playsinline
    autoplay
  ></video>
  <canvas bind:this={canvas} class="hidden"></canvas>

  {#if !streamAtivo}
    <div class="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
      {#if erro}
        <p class="text-xs text-gray-300">{erro}</p>
      {:else}
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#9aa0a8" stroke-width="1.8">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <path d="M14 14h3v3h-3zM19 14h2v2h-2zM14 19h2v2h-2zM19 19h2v2h-2z" />
        </svg>
        <p class="text-xs text-gray-400">Câmera desligada</p>
      {/if}
      <button
        type="button"
        class="text-xs font-bold text-white !py-2.5 !px-5 rounded-full"
        style="background: linear-gradient(135deg, #ef2334, #b80311)"
        onclick={iniciar}
      >
        {erro ? 'Tentar novamente' : 'Ligar câmera'}
      </button>
    </div>
  {:else}
    <div class="absolute inset-0 pointer-events-none flex items-center justify-center">
      <div class="w-3/5 aspect-square relative">
        <div class="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-calper-red rounded-tl-lg"></div>
        <div class="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-calper-red rounded-tr-lg"></div>
        <div class="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-calper-red rounded-bl-lg"></div>
        <div class="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-calper-red rounded-br-lg"></div>
      </div>
    </div>
    <button
      type="button"
      class="absolute bottom-3 right-3 text-xs font-semibold text-white bg-black/40 rounded-lg px-3 py-1.5"
      onclick={parar}
    >
      Desligar
    </button>
  {/if}
</div>