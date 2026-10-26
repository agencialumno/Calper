<script>
  import IniciarAtendimento from '$lib/components/IniciarAtendimento.svelte';
  import { agruparUnidades } from './agrupamento.js';
  import UnidadeStatus from '$lib/components/UnidadeStatus.svelte';
  import { OPCOES_QUITACAO } from '$lib/rotulosUnidade.js';

  let { data } = $props();

  // quantos andares ficam abertos por padrão em cada bloco (quando não há filtro)
  const ANDARES_ABERTOS_PADRAO = 2;

  let busca = $state(data.q);
  let quitacao = $state('');
  let grupo = $state('');
  let tipologia = $state('');
  let semComprador = $state(false);
  // aberturas/fechamentos manuais; zera quando o filtro muda
  let manual = $state({});

  const statusUnidade = {
    regularizado: null,
    troca_titularidade: { texto: 'Troca de titularidade', cls: 'bg-amber-50 text-amber-700' },
    distrato: { texto: 'Distrato', cls: 'bg-red-50 text-red-700' }
  };

  const tipologias = $derived([...new Set(data.unidades.map((u) => u.tipologia).filter(Boolean))].sort());
  const filtroAtivo = $derived(Boolean(busca.trim() || quitacao || grupo || tipologia || semComprador));

  function normalizar(t) {
    return String(t ?? '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase();
  }

  const filtradas = $derived.by(() => {
    const termo = normalizar(busca.trim());
    return data.unidades.filter((u) => {
      if (termo) {
        const alvo = normalizar(
          [u.numero, u.bloco, u.empreendimento, ...u.compradores.map((c) => c.nome), ...u.investidores].join(' ')
        );
        if (!alvo.includes(termo)) return false;
      }
      if (quitacao === 'sem' ? u.statusQuitacao : quitacao && u.statusQuitacao !== quitacao) return false;
      if (grupo === 'sem' ? u.grupo : grupo && u.grupo !== grupo) return false;
      if (tipologia && u.tipologia !== tipologia) return false;
      if (semComprador && (u.compradores.length > 0 || u.investidores.length > 0)) return false;
      return true;
    });
  });

  const grupos = $derived(agruparUnidades(filtradas));
  const varios = $derived(new Set(data.unidades.map((u) => u.empreendimento)).size > 1);

  // zera as aberturas manuais sempre que algum filtro muda
  $effect(() => {
    busca;
    quitacao;
    grupo;
    tipologia;
    semComprador;
    manual = {};
  });

  function andarAberto(chave, indice) {
    if (chave in manual) return manual[chave];
    return filtroAtivo || indice < ANDARES_ABERTOS_PADRAO;
  }

  function blocoAberto(chave) {
    return chave in manual ? manual[chave] : true;
  }

  function alternar(chave, atual) {
    manual[chave] = !atual;
  }

  function definirTodos(abrir) {
    const novo = {};
    for (const b of grupos) {
      novo[b.chave] = true;
      for (const a of b.andares) novo[a.chave] = abrir;
    }
    manual = novo;
  }

  function limpar() {
    busca = '';
    quitacao = '';
    grupo = '';
    tipologia = '';
    semComprador = false;
  }

  function rotuloAndar(andar) {
    return andar === null ? 'Sem andar definido' : `${andar}º andar`;
  }

  function plural(n, singular, pluralTxt) {
    return `${n} ${n === 1 ? singular : pluralTxt}`;
  }
</script>

<svelte:head>
  <title>Unidades — Calper</title>
</svelte:head>

<div class="p-5 md:p-10 max-w-5xl">
  <!-- mobile: ações logo no topo, acima do título -->
  <div class="flex flex-wrap gap-2.5 mb-5 md:hidden">
    <a href="/admin/unidades/nova" class="btn-primary text-sm !py-2.5 flex-1 text-center">+ Nova unidade</a>
    <a href="/admin/unidades/importar" class="btn-outline text-sm !py-2.5 flex-1 text-center">Importar planilha</a>
    <a href="/admin/empreendimentos/nova" class="btn-outline text-sm !py-2.5 w-full text-center">
      + Novo empreendimento
    </a>
  </div>

  <header class="flex items-end justify-between flex-wrap gap-4 mb-6 md:mb-8">
    <div>
      <h1 class="text-2xl md:text-3xl font-extrabold text-calper-dark">Unidades</h1>
      <p class="text-sm md:text-base text-gray-500 mt-1">
        {#if filtroAtivo}
          {plural(filtradas.length, 'unidade encontrada', 'unidades encontradas')} de {data.total}
        {:else}
          {plural(data.total, 'unidade cadastrada', 'unidades cadastradas')}
        {/if}
      </p>
    </div>
    <div class="hidden md:flex gap-2.5">
      <a href="/admin/empreendimentos/nova" class="btn-outline text-sm !py-2.5">+ Novo empreendimento</a>
      <a href="/admin/unidades/importar" class="btn-outline text-sm !py-2.5">Importar planilha</a>
      <a href="/admin/unidades/nova" class="btn-primary text-sm !py-2.5">+ Nova unidade</a>
    </div>
  </header>

  <!-- filtros -->
  <section class="card p-4 md:p-5 mb-6 flex flex-col gap-3.5" aria-label="Filtros">
    <input
      type="search"
      bind:value={busca}
      placeholder="Buscar por unidade, nome do comprador/proprietário/investidor, bloco ou empreendimento..."
      class="input"
    />
    <div class="grid grid-cols-2 md:grid-cols-4 gap-2.5">
      <select bind:value={quitacao} class="input !py-2.5 text-sm" aria-label="Status de quitação">
        <option value="">Quitação: todas</option>
        {#each OPCOES_QUITACAO as o}
          <option value={o.valor}>{o.rotulo}</option>
        {/each}
        <option value="sem">Não informada</option>
      </select>
      <select bind:value={grupo} class="input !py-2.5 text-sm" aria-label="Grupo">
        <option value="">Grupo: todos</option>
        <option value="A">Grupo A</option>
        <option value="B">Grupo B</option>
        <option value="sem">Sem grupo</option>
      </select>
      <select bind:value={tipologia} class="input !py-2.5 text-sm" aria-label="Tipologia">
        <option value="">Tipologia: todas</option>
        {#each tipologias as t}
          <option value={t}>{t}</option>
        {/each}
      </select>
      <label
        class="flex items-center gap-2 rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-calper-dark cursor-pointer"
      >
        <input type="checkbox" bind:checked={semComprador} class="accent-calper-red" />
        Sem comprador
      </label>
    </div>
    <div class="flex items-center justify-between gap-3 text-sm">
      <div class="flex gap-4">
        <button type="button" class="font-semibold text-gray-600 hover:text-calper-dark" onclick={() => definirTodos(true)}>
          Expandir tudo
        </button>
        <button type="button" class="font-semibold text-gray-600 hover:text-calper-dark" onclick={() => definirTodos(false)}>
          Recolher tudo
        </button>
      </div>
      {#if filtroAtivo}
        <button type="button" class="font-semibold text-calper-red" onclick={limpar}>Limpar filtros</button>
      {/if}
    </div>
  </section>

  {#if grupos.length === 0}
    <div class="card p-10 text-center text-gray-500 text-sm md:text-base">Nenhuma unidade encontrada.</div>
  {:else}
    <div class="flex flex-col gap-8">
      {#each grupos as b (b.chave)}
        {@const abertoBloco = blocoAberto(b.chave)}
        <section>
          <button
            type="button"
            class="w-full flex items-center justify-between gap-3 text-left mb-3"
            aria-expanded={abertoBloco}
            onclick={() => alternar(b.chave, abertoBloco)}
          >
            <span>
              {#if varios}
                <span class="block text-xs font-semibold text-gray-400 tracking-wide uppercase">{b.empreendimento}</span>
              {/if}
              <span class="block text-xl md:text-2xl font-extrabold text-calper-dark">
                Bloco {b.bloco}
                <span class="text-sm md:text-base font-semibold text-gray-500 ml-1">
                  ({plural(b.total, 'unidade', 'unidades')})
                </span>
              </span>
            </span>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              class="text-gray-400 transition-transform shrink-0 {abertoBloco ? 'rotate-180' : ''}"
            >
              <path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>

          {#if abertoBloco}
            <div class="flex flex-col gap-2.5">
              {#each b.andares as a, i (a.chave)}
                {@const aberto = andarAberto(a.chave, i)}
                <div class="card overflow-hidden">
                  <button
                    type="button"
                    class="w-full flex items-center justify-between gap-3 px-4 md:px-5 py-3.5 text-left hover:bg-gray-50"
                    aria-expanded={aberto}
                    onclick={() => alternar(a.chave, aberto)}
                  >
                    <span class="text-base font-bold text-calper-dark">
                      Bloco {b.bloco} — {rotuloAndar(a.andar)}
                      <span class="text-sm font-semibold text-gray-500">
                        ({plural(a.unidades.length, 'unidade', 'unidades')})
                      </span>
                    </span>
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2.5"
                      class="text-gray-400 transition-transform shrink-0 {aberto ? 'rotate-180' : ''}"
                    >
                      <path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </button>

                  {#if aberto}
                    <ul class="border-t border-gray-100 divide-y divide-gray-100">
                      {#each a.unidades as u (u.id)}
                        {@const principal = u.compradores.find((c) => c.principal) ?? u.compradores[0]}
                        {@const temComprador = u.compradores.length > 0 || u.investidores.length > 0}
                        <li class="px-4 md:px-5 py-3 flex flex-col gap-2 hover:bg-gray-50/60">
                          <a
                            href={`/admin/unidades/${u.id}`}
                            class="flex items-center gap-x-4 gap-y-1 flex-wrap"
                          >
                            <span class="w-14 text-base font-extrabold text-calper-dark shrink-0">{u.numero}</span>
                            {#if statusUnidade[u.status]}
                              <span class="px-2.5 py-1 rounded-full text-xs font-bold {statusUnidade[u.status].cls}">
                                {statusUnidade[u.status].texto}
                              </span>
                            {/if}
                            <span class="md:ml-auto text-sm min-w-0 md:max-w-[18rem] truncate">
                              {#if temComprador}
                                <span class="text-gray-600">
                                  {principal?.nome ?? u.investidores[0]}{u.compradores.length > 1
                                    ? ` +${u.compradores.length - 1}`
                                    : ''}
                                </span>
                              {:else}
                                <span class="text-gray-400">sem comprador</span>
                              {/if}
                            </span>
                          </a>
                          <UnidadeStatus unidade={u} podeEditar={data.podeEditar} />
                          <IniciarAtendimento unidadeId={u.id} atendimento={u.atendimento} />
                        </li>
                      {/each}
                    </ul>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        </section>
      {/each}
    </div>
  {/if}
</div>
