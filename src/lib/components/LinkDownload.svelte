<script>
  // Link de download com estado próprio: mostra "Baixando…" só neste botão (não trava a tela inteira), volta ao
  // normal assim que o arquivo chega e mostra uma mensagem se falhar ou demorar demais. Sem JS, o link comum
  // (href) continua funcionando como download normal.
  let { href, class: classe = '', tempoLimiteMs = 60000, children } = $props();

  let baixando = $state(false);
  let erro = $state('');

  function nomeDoArquivo(resposta) {
    const disp = resposta.headers.get('content-disposition') ?? '';
    const m = disp.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
    return m ? decodeURIComponent(m[1] ?? m[2]) : 'arquivo';
  }

  async function baixar(e) {
    e.preventDefault();
    if (baixando) return;
    baixando = true;
    erro = '';
    const controle = new AbortController();
    const timer = setTimeout(() => controle.abort(), tempoLimiteMs);
    try {
      const resposta = await fetch(href, { signal: controle.signal });
      const tipo = resposta.headers.get('content-type') ?? '';
      // sessão expirada: o servidor redireciona ao login e a resposta final é uma página HTML
      if (!resposta.ok || tipo.includes('text/html')) {
        throw new Error(resposta.status === 404 ? 'O arquivo não foi encontrado.' : 'Sessão expirada ou arquivo indisponível.');
      }
      const blob = await resposta.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nomeDoArquivo(resposta);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 15000);
    } catch (err) {
      erro =
        err?.name === 'AbortError'
          ? 'O download demorou demais. Tente novamente.'
          : (err?.message && err.message !== 'Failed to fetch' ? err.message : 'Não foi possível baixar. Verifique a conexão e tente novamente.');
    } finally {
      clearTimeout(timer);
      baixando = false;
    }
  }
</script>

<a {href} onclick={baixar} class={classe} aria-busy={baixando} data-sveltekit-reload>
  {#if baixando}
    <span class="inline-flex items-center gap-1.5">
      <svg class="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true">
        <path d="M21 12a9 9 0 11-6.2-8.55" stroke-linecap="round" />
      </svg>
      Baixando…
    </span>
  {:else}
    {@render children()}
  {/if}
</a>
{#if erro}
  <span class="block text-xs font-semibold text-red-600 mt-1" role="alert">{erro}</span>
{/if}
