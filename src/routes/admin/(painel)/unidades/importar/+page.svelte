<script>
  import { enhance } from '$app/forms';
  import Papa from 'papaparse';
  import { cpfValido, emailValido, somenteDigitos } from '$lib/cpf.js';

  let { form } = $props();

  // etapa: 'upload' | 'mapear' | 'confirmar'
  let etapa = $state('upload');
  let nomeArquivo = $state('');
  let cabecalhos = $state([]);
  let linhasBrutas = $state([]);

  const camposObrigatorios = [
    { chave: 'empreendimento', rotulo: 'Empreendimento' },
    { chave: 'bloco', rotulo: 'Bloco' },
    { chave: 'numero', rotulo: 'Número da unidade' },
    { chave: 'investidorNome', rotulo: 'Nome do investidor' },
    { chave: 'investidorCpf', rotulo: 'CPF' },
    { chave: 'investidorEmail', rotulo: 'E-mail' }
  ];

  let mapeamento = $state({});

  function onArquivoSelecionado(e) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    nomeArquivo = arquivo.name;

    Papa.parse(arquivo, {
      header: true,
      skipEmptyLines: true,
      complete: (resultado) => {
        cabecalhos = resultado.meta.fields ?? [];
        linhasBrutas = resultado.data;

        // tenta adivinhar o mapeamento por nome de coluna parecido
        for (const campo of camposObrigatorios) {
          const achado = cabecalhos.find((h) => normalizar(h).includes(normalizar(campo.chave)));
          mapeamento[campo.chave] = achado ?? '';
        }
        etapa = 'mapear';
      },
      error: () => {
        alert('Não foi possível ler o arquivo. Confirme que é um CSV válido.');
      }
    });
  }

  function normalizar(texto) {
    return texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  let linhasMapeadas = $derived(
    linhasBrutas.map((linha) => ({
      empreendimento: linha[mapeamento.empreendimento] ?? '',
      bloco: linha[mapeamento.bloco] ?? '',
      numero: linha[mapeamento.numero] ?? '',
      investidorNome: linha[mapeamento.investidorNome] ?? '',
      investidorCpf: linha[mapeamento.investidorCpf] ?? '',
      investidorEmail: linha[mapeamento.investidorEmail] ?? ''
    }))
  );

  function validarLinha(l) {
    const problemas = [];
    if (!l.empreendimento) problemas.push('empreendimento vazio');
    if (!l.bloco) problemas.push('bloco vazio');
    if (!l.numero) problemas.push('número vazio');
    if (!l.investidorNome) problemas.push('nome vazio');
    if (!cpfValido(somenteDigitos(l.investidorCpf))) problemas.push('CPF inválido');
    if (!emailValido(l.investidorEmail)) problemas.push('e-mail inválido');
    return problemas;
  }

  let linhasValidadas = $derived(linhasMapeadas.map((l) => ({ ...l, problemas: validarLinha(l) })));
  let totalValidas = $derived(linhasValidadas.filter((l) => l.problemas.length === 0).length);
  let totalInvalidas = $derived(linhasValidadas.length - totalValidas);
  let mapeamentoCompleto = $derived(camposObrigatorios.every((c) => mapeamento[c.chave]));

  function baixarCredenciaisCsv() {
    const linhasCsv = [
      ['nome', 'cpf', 'email', 'senha_temporaria'],
      ...form.credenciais.map((c) => [c.nome, c.cpf, c.email, c.senhaTemporaria])
    ];
    const csv = linhasCsv.map((l) => l.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `credenciais-importacao-${form.loteId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

<svelte:head>
  <title>Importar unidades — Calper</title>
</svelte:head>

<div class="p-8 max-w-4xl">
  <a href="/admin/unidades" class="text-sm text-gray-500 hover:text-calper-dark">← Unidades</a>

  {#if form?.sucesso}
    <div class="card p-7 mt-4">
      <h1 class="text-lg font-bold text-calper-dark mb-1">Importação concluída</h1>
      <p class="text-sm text-gray-500 mb-6">
        {form.unidadesCriadas} unidade(s) nova(s) e {form.investidoresCriados} investidor(es) novo(s).
      </p>

      {#if form.credenciais.length}
        <div class="border border-gray-200 rounded-xl p-4 mb-5">
          <div class="flex items-center justify-between mb-2">
            <div class="text-sm font-bold text-calper-dark">
              {form.credenciais.length} senha(s) temporária(s) geradas
            </div>
            <button type="button" class="btn-outline text-xs !py-2" onclick={baixarCredenciaisCsv}>
              Baixar CSV
            </button>
          </div>
          <p class="text-xs text-gray-500">
            Envie essas credenciais em lotes (por empreendimento/bloco) — evite disparar tudo de uma
            vez. A planilha baixada tem nome, CPF, e-mail e senha temporária de cada investidor novo.
          </p>
        </div>
      {/if}

      {#if form.erros.length}
        <div class="border border-amber-200 bg-amber-50 rounded-xl p-4 mb-5">
          <div class="text-sm font-bold text-amber-800 mb-2">
            {form.erros.length} linha(s) não importada(s)
          </div>
          <ul class="text-xs text-amber-800 flex flex-col gap-1 max-h-40 overflow-y-auto">
            {#each form.erros as e}
              <li>{e.linha ? `Linha ${e.linha}: ` : ''}{e.motivo}</li>
            {/each}
          </ul>
        </div>
      {/if}

      <a href="/admin/unidades" class="btn-primary inline-block text-sm">Ver unidades</a>
    </div>
  {:else if etapa === 'upload'}
    <h1 class="text-xl font-bold text-calper-dark mt-4 mb-2">Importar unidades em massa</h1>
    <p class="text-sm text-gray-500 mb-6">
      Envie uma planilha em CSV. Cada linha representa um investidor — uma unidade com mais de um
      investidor aparece em várias linhas repetindo empreendimento/bloco/número.
    </p>

    <label
      class="card border-dashed p-10 flex flex-col items-center justify-center text-center cursor-pointer hover:border-calper-red"
    >
      <span class="text-sm font-semibold text-calper-dark mb-1">Clique para escolher o arquivo CSV</span>
      <span class="text-xs text-gray-400">ou arraste o arquivo aqui</span>
      <input type="file" accept=".csv" class="hidden" onchange={onArquivoSelecionado} />
    </label>
  {:else if etapa === 'mapear'}
    <h1 class="text-xl font-bold text-calper-dark mt-4 mb-1">Mapeie as colunas</h1>
    <p class="text-sm text-gray-500 mb-6">
      {nomeArquivo} · {linhasBrutas.length} linha(s) encontrada(s)
    </p>

    <div class="card p-6 mb-6">
      <div class="grid grid-cols-2 gap-4">
        {#each camposObrigatorios as campo}
          <div>
            <label for={`map-${campo.chave}`} class="block text-sm font-semibold text-calper-dark mb-1.5">
              {campo.rotulo}
            </label>
            <select id={`map-${campo.chave}`} class="input" bind:value={mapeamento[campo.chave]}>
              <option value="">— selecione a coluna —</option>
              {#each cabecalhos as h}
                <option value={h}>{h}</option>
              {/each}
            </select>
          </div>
        {/each}
      </div>
    </div>

    {#if mapeamentoCompleto}
      <div class="flex items-center gap-4 mb-4">
        <span class="text-sm font-semibold text-green-700">{totalValidas} linha(s) válida(s)</span>
        {#if totalInvalidas > 0}
          <span class="text-sm font-semibold text-calper-red">{totalInvalidas} com problema</span>
        {/if}
      </div>

      <div class="card overflow-hidden mb-6">
        <table class="w-full text-xs border-collapse">
          <thead>
            <tr class="text-left text-gray-400 uppercase text-[10.5px]">
              <th class="px-3 py-2">Empreendimento</th>
              <th class="px-3 py-2">Bloco</th>
              <th class="px-3 py-2">Unidade</th>
              <th class="px-3 py-2">Investidor</th>
              <th class="px-3 py-2">CPF</th>
              <th class="px-3 py-2">E-mail</th>
              <th class="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {#each linhasValidadas.slice(0, 30) as l, i}
              <tr class="border-t border-gray-100 {l.problemas.length ? 'bg-red-50/50' : ''}">
                <td class="px-3 py-2">{l.empreendimento}</td>
                <td class="px-3 py-2">{l.bloco}</td>
                <td class="px-3 py-2">{l.numero}</td>
                <td class="px-3 py-2">{l.investidorNome}</td>
                <td class="px-3 py-2">{l.investidorCpf}</td>
                <td class="px-3 py-2">{l.investidorEmail}</td>
                <td class="px-3 py-2">
                  {#if l.problemas.length}
                    <span class="text-calper-red font-semibold">{l.problemas.join(', ')}</span>
                  {:else}
                    <span class="text-green-700 font-semibold">ok</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
        {#if linhasValidadas.length > 30}
          <div class="px-3 py-2.5 text-xs text-gray-400 border-t border-gray-100">
            mostrando as primeiras 30 de {linhasValidadas.length} linhas
          </div>
        {/if}
      </div>

      <form method="POST" action="?/confirmar" use:enhance>
        <input type="hidden" name="nomeArquivo" value={nomeArquivo} />
        <input type="hidden" name="linhas" value={JSON.stringify(linhasMapeadas)} />
        <div class="flex gap-3">
          <button type="button" class="btn-outline text-sm" onclick={() => (etapa = 'upload')}>
            Voltar
          </button>
          <button type="submit" class="btn-primary text-sm" disabled={totalValidas === 0}>
            Confirmar e importar {totalValidas} linha(s) válida(s)
          </button>
        </div>
        {#if totalInvalidas > 0}
          <p class="text-xs text-gray-500 mt-2">
            As linhas com problema serão ignoradas e listadas no resultado — corrija e reimporte
            depois, se precisar.
          </p>
        {/if}
      </form>
    {/if}
  {/if}
</div>
