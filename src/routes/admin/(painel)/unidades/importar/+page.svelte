<script>
  import { enhance } from '$app/forms';
  import AvisoSutil from '$lib/components/AvisoSutil.svelte';
  import LinkDownload from '$lib/components/LinkDownload.svelte';
  import SubmitButton from '$lib/components/SubmitButton.svelte';

  let { data, form } = $props();

  let enviando = $state(false);
  let modo = $state('atualizar');
  let confirmacao = $state('');
  let entendi = $state(false);

  let previa = $derived(form?.previa ?? null);
  let resultado = $derived(form?.resultado ?? null);
  const podeAplicar = $derived(modo === 'atualizar' || (data.podeSobrescrever && entendi && confirmacao.trim() === 'SOBRESCREVER'));

  const rotuloCampo = { tipologia: 'Tipologia', statusQuitacao: 'Pagamento', compradores: 'Compradores', escritura: 'Escritura', vistoriaStatus: 'Vistoria', grupo: 'Grupo' };
  const valor = (campo, v) => (v === null || v === undefined || v === '' ? '—' : campo === 'statusQuitacao' ? v.replace('_', ' ') : v);

  function aoEnviar() {
    enviando = true;
    return async ({ update }) => {
      await update({ reset: false });
      enviando = false;
    };
  }
</script>

<svelte:head>
  <title>Importar base — Calper</title>
</svelte:head>

<div class="p-5 md:p-8 max-w-5xl">
  <a href="/admin/unidades" class="text-sm text-gray-500 hover:text-calper-dark">← Unidades</a>
  <h1 class="text-xl font-bold text-calper-dark mt-3 mb-1">Importar base de entrega de chaves</h1>
  <p class="text-sm text-gray-500 mb-5">
    Envie a planilha (.xlsx). Antes de gravar qualquer coisa você vê uma <strong>prévia</strong> do que vai mudar.
    Nada é apagado sem você pedir.
  </p>

  {#if form?.erro}
    <div class="mb-4"><AvisoSutil>{form.erro}</AvisoSutil></div>
  {/if}

  {#if resultado}
    <div class="card p-6 flex flex-col gap-3 border-l-4 border-l-green-500">
      <div class="text-base font-bold text-green-700">
        {resultado.modo === 'sobrescrever' ? 'Base sobrescrita' : 'Base atualizada'} com "{form.nomeArquivo}"
      </div>
      <ul class="text-sm text-calper-dark list-disc ml-5">
        <li><strong>{resultado.criadas}</strong> unidade(s) criada(s)</li>
        {#if resultado.modo === 'atualizar'}
          <li><strong>{resultado.atualizadas}</strong> unidade(s) atualizada(s)</li>
          <li><strong>{resultado.iguais}</strong> já estavam iguais</li>
        {/if}
      </ul>
      <div class="flex gap-3 mt-2">
        <a href="/admin/unidades" class="btn-primary text-sm !py-2.5">Ver unidades</a>
        <a href="/admin/unidades/importar" class="btn-outline text-sm !py-2.5">Nova importação</a>
      </div>
    </div>
  {:else}
    <form method="POST" action="?/previa" enctype="multipart/form-data" use:enhance={aoEnviar} class="card p-5 flex flex-col gap-3 mb-6">
      <label for="arquivo" class="text-sm font-bold text-calper-dark">Planilha da base (.xlsx)</label>
      <input id="arquivo" name="arquivo" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" class="input" required />
      <p class="text-xs text-gray-500">
        Colunas lidas: BLOCO, UNIDADE, TIPOLOGIA, NOME DO CLIENTE, COMPRADOR PRINCIPAL, ESCRITURA, STATUS QUITAÇÃO,
        VISTORIA DE UNIDADE (e GRUPO, se existir). Células em branco nunca apagam o que já está cadastrado.
      </p>
      <SubmitButton loading={enviando}>Gerar prévia</SubmitButton>
    </form>

    {#if previa}
      <section class="flex flex-col gap-5" aria-label="Prévia da importação">
        <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
          {#each [['Na planilha', previa.resumo.total, 'bg-gray-50 text-calper-dark'], ['Novas', previa.resumo.novas, 'bg-green-50 text-green-700'], ['A atualizar', previa.resumo.alteradas, 'bg-amber-50 text-amber-700'], ['Já iguais', previa.resumo.iguais, 'bg-gray-50 text-calper-dark'], ['Fora da planilha', previa.resumo.ausentes, 'bg-gray-50 text-calper-dark']] as [rotulo, n, cor]}
            <div class="rounded-2xl p-4 {cor}">
              <div class="text-2xl font-extrabold">{n}</div>
              <div class="text-xs font-bold">{rotulo}</div>
            </div>
          {/each}
        </div>

        {#if form.leitura.erros.length > 0}
          <AvisoSutil>
            {form.leitura.erros.length} linha(s) ignorada(s) por erro: {form.leitura.erros.slice(0, 5).map((e) => `${e.aba} linha ${e.linha} (${e.motivo})`).join('; ')}
          </AvisoSutil>
        {/if}
        {#if form.leitura.avisos.length > 0}
          <AvisoSutil>{form.leitura.avisos.slice(0, 5).join(' ')}{form.leitura.avisos.length > 5 ? ` (+${form.leitura.avisos.length - 5} avisos)` : ''}</AvisoSutil>
        {/if}
        {#if form.leitura.colunasFaltando.length > 0}
          <div class="rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-sm p-4">
            A planilha não tem a coluna <strong>{form.leitura.colunasFaltando.join(', ')}</strong>. Em <strong>Atualizar</strong> o valor
            atual é mantido; em <strong>Sobrescrever</strong> ele é perdido (as unidades voltam sem grupo).
          </div>
        {/if}
        {#if previa.resumo.unidadesComCompradoresForaDaPlanilha > 0}
          <div class="rounded-xl border border-amber-300 bg-amber-50 text-amber-900 text-sm p-4">
            <strong>{previa.resumo.unidadesComCompradoresForaDaPlanilha} unidade(s)</strong> têm compradores cadastrados (por exemplo, co-compradores) que
            <strong>não aparecem na planilha</strong>, que lista só um comprador por unidade.
            Em <strong>Atualizar</strong> eles são <strong>mantidos</strong>; em <strong>Sobrescrever</strong> eles são <strong>perdidos</strong>.
            <details class="mt-2">
              <summary class="cursor-pointer font-bold text-xs">Ver as unidades</summary>
              <ul class="mt-1 text-xs max-h-48 overflow-y-auto">
                {#each previa.compradoresPerdidos as c (c.bloco + c.numero)}
                  <li>Bloco {c.bloco} - nº {c.numero}: {c.nomes.join(' | ')}</li>
                {/each}
              </ul>
            </details>
          </div>
        {/if}
        {#if previa.resumo.celulasEmBrancoIgnoradas > 0}
          <p class="text-xs text-gray-500">
            {previa.resumo.celulasEmBrancoIgnoradas} célula(s) em branco na planilha (em unidades que já têm valor) foram ignoradas no modo Atualizar — nada é apagado por célula vazia.
          </p>
        {/if}

        {#if previa.afetadas.length > 0}
          <div class="rounded-xl border border-red-200 bg-red-50 p-4">
            <div class="text-sm font-bold text-red-800 mb-2">
              ⚠ {previa.afetadas.length} unidade(s) a atualizar já têm agendamento ou documento
            </div>
            <ul class="text-sm text-red-900 flex flex-col gap-1">
              {#each previa.afetadas as a (a.bloco + a.numero)}
                <li>
                  <strong>Bloco {a.bloco} - nº {a.numero}</strong> — agendamento: {a.agendamentos.join(', ')}{a.documentos.length ? ` · documentos: ${a.documentos.join(', ')}` : ''}
                  {#if a.mudaComprador}
                    <span class="font-bold">· o comprador muda{a.gravidade === 'alta' ? ' (documentos já gerados ficam com o nome antigo)' : ''}</span>
                  {/if}
                </li>
              {/each}
            </ul>
            <p class="text-xs text-red-700 mt-2">Em Atualizar os agendamentos e documentos não são tocados; só os dados da unidade mudam.</p>
          </div>
        {/if}

        {#if previa.ocultas.length > 0}
          <details class="card p-4">
            <summary class="text-sm font-bold text-calper-dark cursor-pointer">
              {previa.ocultas.length} unidade(s) não aparecerão no agendamento público (estoque, jurídico, notificação ou sem comprador)
            </summary>
            <ul class="mt-2 text-sm text-gray-700 columns-2 md:columns-3">
              {#each previa.ocultas as o (o.bloco + o.numero)}
                <li>Bloco {o.bloco} - nº {o.numero} <span class="text-xs text-gray-400">({o.motivo})</span></li>
              {/each}
            </ul>
          </details>
        {/if}

        <details class="card p-4" open={previa.alteradas.length > 0 && previa.alteradas.length <= 30}>
          <summary class="text-sm font-bold text-calper-dark cursor-pointer">O que muda em cada unidade ({previa.alteradas.length})</summary>
          <div class="mt-3 max-h-96 overflow-y-auto flex flex-col gap-2">
            {#each previa.alteradas as a (a.bloco + a.numero)}
              <div class="text-sm border-b border-gray-100 pb-2">
                <div class="font-bold text-calper-dark">Bloco {a.bloco} - nº {a.numero}</div>
                {#each a.diferencas as d}
                  <div class="text-xs text-gray-600">
                    {rotuloCampo[d.campo]}: <span class="text-gray-400">{valor(d.campo, d.de)}</span> → <strong class="text-calper-dark">{valor(d.campo, d.para)}</strong>
                  </div>
                {/each}
              </div>
            {:else}
              <p class="text-sm text-gray-400">Nenhuma unidade existente muda.</p>
            {/each}
          </div>
        </details>

        {#if previa.novas.length > 0}
          <details class="card p-4">
            <summary class="text-sm font-bold text-calper-dark cursor-pointer">Unidades novas ({previa.novas.length})</summary>
            <ul class="mt-2 text-sm text-gray-700 columns-2 md:columns-3">
              {#each previa.novas as n (n.bloco + n.numero)}
                <li>Bloco {n.bloco} - nº {n.numero} <span class="text-xs text-gray-400">{n.tipologia ?? ''}</span></li>
              {/each}
            </ul>
          </details>
        {/if}
        {#if previa.ausentes.length > 0}
          <p class="text-xs text-gray-500">
            {previa.ausentes.length} unidade(s) cadastradas não estão na planilha: ficam como estão em Atualizar (nunca são apagadas) e são apagadas em Sobrescrever.
          </p>
        {/if}

        <!-- escolha explícita do modo -->
        <form method="POST" action="?/aplicar" use:enhance={aoEnviar} class="card p-5 flex flex-col gap-4">
          <input type="hidden" name="unidadesJson" value={form.unidadesJson} />
          <input type="hidden" name="nomeArquivo" value={form.nomeArquivo} />
          <input type="hidden" name="previaHash" value={previa.hash} />
          <div class="text-base font-bold text-calper-dark">O que fazer com essa planilha?</div>

          <label class="flex gap-3 border rounded-xl p-4 cursor-pointer {modo === 'atualizar' ? 'border-calper-red bg-red-50/40' : 'border-gray-200'}">
            <input type="radio" name="modo" value="atualizar" bind:group={modo} class="mt-1" />
            <span>
              <span class="block text-sm font-bold text-calper-dark">Atualizar <span class="text-xs font-semibold text-green-700">(recomendado)</span></span>
              <span class="block text-xs text-gray-600 mt-1">
                Casa por bloco + número, altera só os campos que mudaram e cria as unidades novas. Não toca em agendamentos,
                documentos, presenças nem histórico, e não apaga nada.
              </span>
            </span>
          </label>

          <label class="flex gap-3 border rounded-xl p-4 {data.podeSobrescrever ? 'cursor-pointer' : 'opacity-60'} {modo === 'sobrescrever' ? 'border-red-500 bg-red-50' : 'border-gray-200'}">
            <input type="radio" name="modo" value="sobrescrever" bind:group={modo} class="mt-1" disabled={!data.podeSobrescrever} />
            <span>
              <span class="block text-sm font-bold text-red-700">Sobrescrever — apaga tudo e importa do zero</span>
              <span class="block text-xs text-gray-600 mt-1">
                Destrutivo e sem volta. {data.podeSobrescrever ? '' : 'Só o perfil admin pode usar esta opção.'}
              </span>
            </span>
          </label>

          {#if modo === 'sobrescrever'}
            <div class="rounded-xl border-2 border-red-300 bg-red-50 p-4 flex flex-col gap-3">
              <div class="text-sm font-bold text-red-800">Isto vai APAGAR, de forma definitiva:</div>
              <ul class="text-sm text-red-900 grid grid-cols-2 gap-x-4 list-disc ml-5">
                <li>{previa.apagar.unidades} unidade(s)</li>
                <li>{previa.apagar.agendamentos} agendamento(s)</li>
                <li>{previa.apagar.documentos} documento(s) assinado(s)</li>
                <li>{previa.apagar.procuracoes} procuração(ões)</li>
                <li>{previa.apagar.presencas} registro(s) de presença</li>
                <li>{previa.apagar.historico} item(ns) de histórico</li>
                <li>{previa.apagar.investidores} investidor(es) e as sessões deles</li>
                <li>{previa.apagar.acompanhantes} acompanhante(s), {previa.apagar.emails} e-mail(s) enviados</li>
              </ul>
              {#if previa.resumo.unidadesComCompradoresForaDaPlanilha > 0}
                <div class="text-sm font-bold text-red-900">
                  Inclui perder compradores/co-compradores em {previa.resumo.unidadesComCompradoresForaDaPlanilha} unidade(s) (a planilha lista só um por unidade).
                </div>
              {/if}
              <div class="text-xs text-red-800">
                <strong>Não é apagado:</strong> funcionários e logins da equipe, logs de auditoria, agenda, atualizações da obra, o empreendimento e os
                textos/dados fixos do termo e do checklist.
              </div>
              <LinkDownload href="/admin/unidades/importar/copia" class="text-sm font-bold text-red-700 underline">
                Baixar uma cópia dos dados que serão apagados (JSON, sem arquivos nem senhas)
              </LinkDownload>
              <label class="flex items-start gap-2 text-sm text-red-900">
                <input type="checkbox" name="entendi" bind:checked={entendi} class="mt-0.5" />
                Entendo que isto apaga os dados acima e não pode ser desfeito.
              </label>
              <div>
                <label for="confirmacao" class="block text-xs font-bold text-red-800 mb-1">Digite SOBRESCREVER para confirmar</label>
                <input id="confirmacao" name="confirmacao" bind:value={confirmacao} autocomplete="off" class="input !py-2 text-sm" />
              </div>
            </div>
          {/if}

          <SubmitButton loading={enviando} disabled={!podeAplicar} class="disabled:opacity-50">
            {modo === 'sobrescrever' ? 'Apagar tudo e importar do zero' : 'Aplicar atualização'}
          </SubmitButton>
        </form>
      </section>
    {/if}

    <p class="text-xs text-gray-500 mt-6">
      Precisa criar contas de investidores a partir de uma lista (CSV)?
      <a href="/admin/unidades/importar/investidores" class="font-bold text-calper-red">Importar investidores por CSV</a>
    </p>
  {/if}
</div>
