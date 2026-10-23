<script>
  // Cartão de status de uma unidade — o MESMO componente nas abas Unidades e Chaves.
  // Mostra as etiquetas (Tipologia, Grupo, Status-Quitação, Vistoria de Unidade, Escritura Atual), um "ver mais" com
  // os demais dados da base e, para admin/supervisor, a edição direta dos status.
  import { invalidateAll } from '$app/navigation';
  import {
    OPCOES_ESCRITURA_ATUAL,
    OPCOES_QUITACAO,
    OPCOES_VISTORIA,
    capitalizar,
    linhasVerMais,
    rotuloQuitacao
  } from '$lib/rotulosUnidade.js';

  let { unidade, podeEditar = false } = $props();

  let verMais = $state(false);
  let editando = $state(false);
  let salvando = $state(false);
  let erro = $state('');
  let rascunho = $state({});

  const semAcento = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();

  const corQuitacao = {
    quitada: 'bg-green-50 text-green-700',
    a_vencer: 'bg-amber-50 text-amber-700',
    estoque: 'bg-gray-100 text-gray-600',
    juridico_civel: 'bg-red-50 text-red-700'
  };
  function corVistoria(v) {
    const t = semAcento(v);
    if (t === 'APROVADA') return 'bg-green-50 text-green-700';
    if (t.startsWith('JURIDICO') || t.includes('NOTIFICACAO')) return 'bg-red-50 text-red-700';
    if (t.includes('ESTOQUE')) return 'bg-gray-100 text-gray-600';
    return 'bg-amber-50 text-amber-700';
  }

  const detalhes = $derived(linhasVerMais(unidade));
  const opcoesVistoria = $derived([...new Set([...OPCOES_VISTORIA, ...(unidade.vistoriaStatus ? [unidade.vistoriaStatus] : [])])]);
  const opcoesEscritura = $derived([...new Set([...OPCOES_ESCRITURA_ATUAL, ...(unidade.escrituraAtual ? [unidade.escrituraAtual] : [])])]);
  const opcoesTipologia = $derived([...new Set(['2 QUARTOS', '3 QUARTOS', ...(unidade.tipologia ? [unidade.tipologia] : [])])]);

  function abrirEdicao() {
    rascunho = {
      tipologia: unidade.tipologia ?? '',
      grupo: unidade.grupo ?? '',
      statusQuitacao: unidade.statusQuitacao ?? '',
      vistoriaStatus: unidade.vistoriaStatus ?? '',
      escrituraAtual: unidade.escrituraAtual ?? ''
    };
    erro = '';
    editando = true;
  }

  async function salvar() {
    salvando = true;
    erro = '';
    try {
      const resposta = await fetch(`/admin/unidades/${unidade.id}/status`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(rascunho)
      });
      const corpo = await resposta.json().catch(() => ({}));
      if (!resposta.ok) throw new Error(corpo.erro ?? corpo.message ?? 'Não foi possível salvar.');
      editando = false;
      await invalidateAll(); // a lista inteira recarrega: filtros e contagens acompanham a mudança
    } catch (e) {
      erro = e.message;
    } finally {
      salvando = false;
    }
  }
</script>

<div class="text-xs" data-testid="unidade-status">
  <div class="flex flex-wrap items-center gap-1.5 font-bold">
    {#if unidade.tipologia}<span class="px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">{unidade.tipologia}</span>{/if}
    {#if unidade.grupo}<span class="px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">Grupo {unidade.grupo}</span>{/if}
    {#if unidade.statusQuitacao}
      <span class="px-2.5 py-1 rounded-full {corQuitacao[unidade.statusQuitacao] ?? 'bg-gray-100 text-gray-600'}">
        Quitação: {rotuloQuitacao(unidade.statusQuitacao)}
      </span>
    {/if}
    {#if unidade.vistoriaStatus}
      <span class="px-2.5 py-1 rounded-full {corVistoria(unidade.vistoriaStatus)}">Vistoria: {capitalizar(unidade.vistoriaStatus)}</span>
    {/if}
    {#if unidade.escrituraAtual}
      <span class="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">Escritura: {capitalizar(unidade.escrituraAtual)}</span>
    {/if}

    <span class="flex items-center gap-3 ml-1 font-semibold">
      {#if detalhes.length > 0}
        <button
          type="button"
          class="text-gray-500 hover:text-calper-dark underline-offset-2 hover:underline"
          aria-expanded={verMais}
          onclick={() => (verMais = !verMais)}
        >
          {verMais ? 'ver menos' : 'ver mais'}
        </button>
      {/if}
      {#if podeEditar && !editando}
        <button type="button" class="text-calper-red hover:underline" onclick={abrirEdicao}>editar status</button>
      {/if}
    </span>
  </div>

  {#if verMais && detalhes.length > 0}
    <dl class="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 rounded-xl bg-gray-50 px-3.5 py-3">
      {#each detalhes as [rotulo, valor]}
        <div class="flex justify-between gap-3">
          <dt class="text-gray-500">{rotulo}</dt>
          <dd class="font-semibold text-calper-dark text-right">{valor}</dd>
        </div>
      {/each}
    </dl>
  {/if}

  {#if editando}
    <form
      class="mt-2.5 rounded-xl border border-gray-200 p-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5"
      onsubmit={(e) => {
        e.preventDefault();
        salvar();
      }}
    >
      <label class="flex flex-col gap-1">
        <span class="font-semibold text-gray-500">Tipologia</span>
        <select class="input !py-2 text-sm" bind:value={rascunho.tipologia}>
          <option value="">—</option>
          {#each opcoesTipologia as o}<option value={o}>{o}</option>{/each}
        </select>
      </label>
      <label class="flex flex-col gap-1">
        <span class="font-semibold text-gray-500">Grupo</span>
        <select class="input !py-2 text-sm" bind:value={rascunho.grupo}>
          <option value="">—</option>
          <option value="A">Grupo A</option>
          <option value="B">Grupo B</option>
        </select>
      </label>
      <label class="flex flex-col gap-1">
        <span class="font-semibold text-gray-500">Status-Quitação</span>
        <select class="input !py-2 text-sm" bind:value={rascunho.statusQuitacao}>
          <option value="">—</option>
          {#each OPCOES_QUITACAO as o}<option value={o.valor}>{o.rotulo}</option>{/each}
        </select>
      </label>
      <label class="flex flex-col gap-1">
        <span class="font-semibold text-gray-500">Vistoria de unidade</span>
        <select class="input !py-2 text-sm" bind:value={rascunho.vistoriaStatus}>
          <option value="">—</option>
          {#each opcoesVistoria as o}<option value={o}>{capitalizar(o)}</option>{/each}
        </select>
      </label>
      <label class="flex flex-col gap-1 sm:col-span-2">
        <span class="font-semibold text-gray-500">Escritura atual</span>
        <select class="input !py-2 text-sm" bind:value={rascunho.escrituraAtual}>
          <option value="">—</option>
          {#each opcoesEscritura as o}<option value={o}>{capitalizar(o)}</option>{/each}
        </select>
      </label>
      {#if erro}<p class="sm:col-span-2 text-calper-red font-semibold">{erro}</p>{/if}
      <div class="sm:col-span-2 flex items-center gap-3">
        <button type="submit" disabled={salvando} class="btn-primary !py-2 !px-4 text-sm disabled:opacity-60">
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
        <button type="button" class="font-semibold text-gray-500" onclick={() => (editando = false)}>Cancelar</button>
      </div>
    </form>
  {/if}
</div>
