<script>
  import LinkDownload from '$lib/components/LinkDownload.svelte';
  import { enhance } from '$app/forms';
  import SubmitButton from '$lib/components/SubmitButton.svelte';
  import AvisoSutil from '$lib/components/AvisoSutil.svelte';
  import { formatarCpf } from '$lib/cpf.js';
  import { fotosParaPdf } from '$lib/fotoParaPdf.js';
  import UnidadeStatus from '$lib/components/UnidadeStatus.svelte';

  let { data, form } = $props();

  let u = $derived(data.unidade);
  let a = $derived(data.agendamento);
  let enviando = $state(false);
  let abrirCorrecao = $state(false);

  // passo 2
  let quem = $state('');
  let arquivo = $state(null);
  let inputProcuracao = $state(null);
  let fotos = $state([]); // fotos tiradas na câmera (cada uma vira uma página do PDF)
  let convertendo = $state(false);
  let erroProcuracao = $state('');

  function colocarArquivo(file) {
    const dt = new DataTransfer();
    if (file) dt.items.add(file);
    inputProcuracao.files = dt.files;
    arquivo = file;
  }

  // a câmera devolve imagem: vira PDF (1 página por foto) antes de entrar no envio, que só aceita documento
  async function aoTirarFoto(e) {
    const nova = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!nova) return;
    erroProcuracao = '';
    convertendo = true;
    try {
      fotos = [...fotos, nova];
      colocarArquivo(await fotosParaPdf(fotos));
    } catch (err) {
      fotos = fotos.slice(0, -1);
      erroProcuracao = err?.message ?? 'Não foi possível converter a foto em PDF.';
    } finally {
      convertendo = false;
    }
  }

  function limparFotos() {
    fotos = [];
    erroProcuracao = '';
    colocarArquivo(null);
  }

  function aoEscolherArquivo(e) {
    const f = e.currentTarget.files?.[0] ?? null;
    erroProcuracao = '';
    if (f && !/\.(pdf|docx?)$/i.test(f.name)) {
      e.currentTarget.value = '';
      arquivo = null;
      erroProcuracao = 'A procuração precisa ser um documento: PDF, DOC ou DOCX. Para foto, use o botão "Tirar foto".';
      return;
    }
    fotos = [];
    arquivo = f;
  }
  let tentouConfirmar = $state(false);
  // CPF digitado em "outra pessoa": a procuração do agendamento só dispensa novo upload se for da mesma pessoa
  let cpfDigitado = $state(null);
  const cpfRetirante = $derived(
    (cpfDigitado ?? (data.retirante?.vinculo === 'procurador' ? a.retiranteCpf : a.procuracaoCpf) ?? '').replace(/\D/g, '')
  );
  const procuracaoVale = $derived(a.temProcuracao && (!a.procuracaoCpf || a.procuracaoCpf === cpfRetirante));
  const exigeProcuracao = $derived(quem === 'outro' && !arquivo && !procuracaoVale);
  const faltaProcuracao = $derived(tentouConfirmar && exigeProcuracao);

  const passos = ['Unidade', 'Quem retira', 'Termo', 'Checklist', 'Concluído'];
  const calperJaAssinou = ['calper_assinou', 'aguardando_cliente', 'assinado'];
  const href = (passo) => `?passo=${passo}`;

  function aoEnviar() {
    enviando = true;
    return async ({ update }) => {
      await update({ reset: false });
      enviando = false;
    };
  }

  // leitura do documento (PDF) na tela do atendimento, antes de criar o envelope
  let previa = $state(null); // { tipo, url }
  let gerandoPrevia = $state(false);

  function aoPedirDocumento({ action }) {
    if (!action.search.includes('previa')) return aoEnviar();
    gerandoPrevia = true;
    return async ({ result, update }) => {
      gerandoPrevia = false;
      if (result.type === 'success' && result.data?.previa) {
        const bytes = Uint8Array.from(atob(result.data.previa.pdfBase64), (c) => c.charCodeAt(0));
        previa = { tipo: result.data.previa.tipo, url: URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })) };
      } else {
        await update({ reset: false });
      }
    };
  }

  function fecharPrevia() {
    if (previa) URL.revokeObjectURL(previa.url);
    previa = null;
  }

  function aoConfirmarRetirante({ cancel }) {
    tentouConfirmar = true;
    if (exigeProcuracao) {
      cancel();
      return;
    }
    return aoEnviar();
  }

  function formatarDataHora(iso) {
    return new Date(iso).toLocaleString('pt-BR', {
      timeZone: 'UTC',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function formatarHora(iso) {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  const rotuloStatus = {
    pendente: 'Aguardando a assinatura da Calper',
    calper_assinou: 'Calper assinou — aguardando o checklist',
    aguardando_cliente: 'Calper assinou — aguardando o cliente',
    assinado: 'Assinado por todos'
  };
  const ok = 'bg-green-50 text-green-700';
  const alerta = 'bg-amber-50 text-amber-700';
</script>

<svelte:head>
  <title>Entrega de chaves — Bloco {u.bloco} nº {u.numero}</title>
</svelte:head>

<div class="p-5 md:p-8 max-w-3xl">
  <a href="/admin/entrega-chaves" class="text-sm text-gray-500 hover:text-calper-dark">← Entrega de chaves</a>
  <h1 class="text-xl font-bold text-calper-dark mt-3 mb-1">Bloco {u.bloco} - nº {u.numero}</h1>
  <p class="text-sm text-gray-500">Agendado para {formatarDataHora(a.dataHora)}</p>
  <p class="text-xs text-gray-500 mb-5">
    Agendamento feito por <strong>{a.nome ?? '—'}</strong>{a.email ? ` (${a.email})` : ''}
    {#if data.retirante}
      · Retira as chaves: <strong>{data.retirante.nome}</strong> ({data.presencas.find((p) => p.vinculo !== 'acompanhante')?.vinculoRotulo ?? ''})
    {/if}
  </p>

  <!-- as etapas são links: dá pra voltar e avançar livremente (o que ainda não pode ser feito explica o motivo) -->
  <ol class="flex flex-wrap gap-1.5 mb-6 text-[11px] font-bold" aria-label="Etapas do atendimento">
    {#each passos as nome, i}
      <li>
        <a
          href={href(i + 1)}
          aria-current={data.passo === i + 1 ? 'step' : undefined}
          class="inline-block px-2.5 py-1 rounded-full {data.passo === i + 1
            ? 'bg-calper-red text-white'
            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}"
        >
          {i + 1}. {nome}
        </a>
      </li>
    {/each}
  </ol>

  {#if data.bloqueio && (data.passo === 3 || data.passo === 4)}
    <div class="card p-6 flex flex-col gap-3" data-testid="etapa-bloqueada">
      <div class="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">{data.bloqueio.texto}</div>
      <a href={href(data.bloqueio.passo)} class="btn-primary text-center">{data.bloqueio.rotulo}</a>
      <div class="flex gap-2 text-sm text-gray-500">
        <a href={href(data.passo - 1)} class="flex-1 text-center">← Voltar</a>
        {#if data.passo === 3}<a href={href(4)} class="flex-1 text-center">Avançar →</a>{/if}
      </div>
    </div>
  {/if}

  {#if form?.erro}
    <div class="mb-4"><AvisoSutil>{form.erro}</AvisoSutil></div>
  {/if}
  {#if data.aviso === 'nao-assinado'}
    <div class="mb-4"><AvisoSutil>A assinatura da Calper não foi concluída. Continue de onde parou para assinar.</AvisoSutil></div>
  {/if}
  {#if form?.verificado}
    <div class="mb-4 text-sm font-semibold rounded-xl px-4 py-3 {form.verificado.status === 'assinado' ? 'text-green-700 bg-green-50 border border-green-100' : 'text-amber-700 bg-amber-50 border border-amber-100'}">
      {form.verificado.status === 'assinado'
        ? 'Verificado agora no DocuSign: todos assinaram.'
        : `Verificado agora no DocuSign (${new Date(form.verificado.em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}): ainda aguardando o cliente.`}
    </div>
  {/if}

  <!-- PASSO 1 — consulta -->
  {#if data.bloqueio && (data.passo === 3 || data.passo === 4)}
    <!-- (etapa bloqueada: o aviso está acima) -->
  {:else if data.passo === 1}
    <div class="card p-6 flex flex-col gap-4">
      <div class="text-sm font-bold text-calper-dark">Situação da unidade</div>
      <UnidadeStatus unidade={u} podeEditar={data.podeEditar} />
      <a href={href(2)} class="btn-primary text-center">Continuar</a>
    </div>

    <!-- PASSO 2 — quem retira + lista de presença -->
  {:else if data.passo === 2}
    <form
      method="POST"
      action="?/confirmarRetirante"
      enctype="multipart/form-data"
      use:enhance={aoConfirmarRetirante}
      class="card p-6 flex flex-col gap-4"
    >
      <div class="text-sm font-bold text-calper-dark">Quem está retirando as chaves?</div>

      {#if data.titulares.length === 0}
        <div class="border border-amber-200 bg-amber-50 text-amber-800 text-sm rounded-xl p-3">
          Nenhum comprador cadastrado para esta unidade (Bloco {u.bloco} - nº {u.numero}). Quem retira as chaves
          precisa apresentar procuração.
        </div>
      {/if}

      {#each data.titulares as t (t.id)}
        <label class="flex items-center gap-2.5 text-sm text-calper-dark border border-gray-100 rounded-xl p-3">
          <input type="radio" name="quem" value={t.id} bind:group={quem} required />
          <span>
            {t.nome}
            {#if t.principal}<span class="text-[11px] font-bold text-calper-red ml-1">principal</span>{/if}
            {#if t.cpf}<span class="text-gray-400"> · CPF {t.cpf}</span>{/if}
          </span>
        </label>
      {/each}

      <label class="flex items-center gap-2.5 text-sm text-calper-dark border border-gray-100 rounded-xl p-3">
        <input type="radio" name="quem" value="outro" bind:group={quem} required />
        <span>Outra pessoa (procurador) — exige procuração</span>
      </label>

      {#if quem === 'outro'}
        <div class="border border-gray-200 rounded-xl p-4 flex flex-col gap-3">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label for="nome" class="block text-xs font-semibold text-gray-500 mb-1">Nome completo</label>
              <input id="nome" name="nome" class="input !py-2 text-sm" value={data.retirante?.vinculo === 'procurador' ? (a.retiranteNome ?? '') : (a.procuracaoNome ?? '')} required />
            </div>
            <div>
              <label for="cpf" class="block text-xs font-semibold text-gray-500 mb-1">CPF</label>
              <input
                id="cpf"
                name="cpf"
                inputmode="numeric"
                class="input !py-2 text-sm"
                value={data.retirante?.vinculo === 'procurador' ? (a.retiranteCpf ?? '') : (a.procuracaoCpf ?? '')}
                oninput={(e) => (cpfDigitado = e.currentTarget.value)}
                required
              />
            </div>
          </div>

          {#if a.ehProprietario === false}
            <div class="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-calper-dark">
              <span class="text-xs font-bold text-amber-800 tracking-wide uppercase block mb-0.5">
                Agendado por quem não é o proprietário
              </span>
              <strong>{a.nome ?? '—'}</strong>
              <span class="text-gray-600"> · CPF {a.cpf ? formatarCpf(a.cpf) : '—'}</span>
              {#if a.proprietarioNome}
                <span class="block mt-1 text-gray-600">
                  Proprietário da unidade: <strong class="text-calper-dark">{a.proprietarioNome}</strong>
                </span>
              {/if}
            </div>
          {/if}

          {#if a.temProcuracao}
            <div>
              {#if !procuracaoVale}
                <div class="mb-3">
                  <AvisoSutil>
                    A procuração anexada no agendamento é de{a.procuracaoNome ? ` ${a.procuracaoNome}` : ' outra pessoa'} (CPF {a.procuracaoCpf ? formatarCpf(a.procuracaoCpf) : '—'}). Como quem retira é outra pessoa, anexe a procuração dela abaixo.
                  </AvisoSutil>
                </div>
              {/if}
              <div class="text-xs font-bold text-gray-500 mb-2">
                {procuracaoVale ? 'Procuração anexada no agendamento' : 'Procuração anexada no agendamento (de outra pessoa)'}
              </div>
              {#if a.procuracaoTipo?.startsWith('image/')}
                <img
                  src="/admin/entrega-chaves/{a.id}/procuracao"
                  alt="Procuração anexada no agendamento"
                  class="w-full max-h-[32rem] object-contain rounded-lg border border-gray-100 bg-gray-50"
                />
              {:else}
                <a
                  href="/admin/entrega-chaves/{a.id}/procuracao"
                  target="_blank"
                  rel="noopener"
                  class="inline-block text-sm font-bold text-calper-red border border-gray-200 rounded-lg px-4 py-2.5"
                >
                  Abrir procuração ({a.procuracaoTipo === 'application/pdf' ? 'PDF' : 'documento'}) em nova aba
                </a>
              {/if}
              <div class="mt-2">
                <a
                  href="/admin/entrega-chaves/{a.id}/procuracao"
                  download="procuracao-bloco-{u.bloco}-{u.numero}"
                  class="text-xs font-semibold text-calper-red"
                >
                  Baixar
                </a>
              </div>
            </div>
          {:else if a.ehProprietario === false}
            <div class="text-sm font-semibold text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              Este agendamento não tem procuração anexada. Peça o documento antes de seguir.
            </div>
          {/if}

          <div>
            <label for="procuracao" class="block text-xs font-semibold text-gray-500 mb-1">
              {procuracaoVale ? 'Substituir procuração (opcional)' : 'Procuração (PDF, DOC ou DOCX, até 4 MB) — obrigatória'}
            </label>
            <input
              bind:this={inputProcuracao}
              id="procuracao"
              name="procuracao"
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              class="input"
              onchange={aoEscolherArquivo}
            />

            <!-- procuração só em papel: foto pela câmera do iPad, convertida em PDF (1 página por foto) -->
            <div class="mt-2.5 flex flex-wrap items-center gap-2">
              <label
                class="inline-flex items-center gap-2 text-sm font-bold text-calper-red border border-gray-200 rounded-xl px-3.5 py-2.5 cursor-pointer active:scale-95"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                {fotos.length ? 'Adicionar outra página' : 'Tirar foto da procuração'}
                <!-- sem "name": não vai no envio; a foto entra como PDF pelo campo acima -->
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  class="hidden"
                  data-converte-antes
                  onchange={aoTirarFoto}
                />
              </label>
              {#if convertendo}
                <span class="text-xs text-gray-500">Convertendo em PDF…</span>
              {:else if fotos.length}
                <span class="text-xs text-gray-600">{fotos.length} foto(s) → PDF de {fotos.length} página(s)</span>
                <button type="button" class="text-xs font-semibold text-gray-500 underline" onclick={limparFotos}>
                  descartar fotos
                </button>
              {/if}
            </div>
            {#if erroProcuracao}
              <div class="mt-2.5"><AvisoSutil>{erroProcuracao}</AvisoSutil></div>
            {/if}
            {#if faltaProcuracao}
              <div class="mt-2.5">
                <AvisoSutil>{a.temProcuracao ? 'Envie a procuração da pessoa que está retirando as chaves para continuar.' : 'Quem retira não é comprador desta unidade: envie a procuração para continuar.'}</AvisoSutil>
              </div>
            {/if}
          </div>
        </div>
      {/if}

      {#if a.temIdentidade}
        <div class="rounded-xl border border-gray-200 px-4 py-3 text-sm">
          <div class="text-xs font-bold text-gray-500 mb-1.5">Documento de identidade enviado no agendamento ({a.nome ?? '—'})</div>
          {#if a.identidadeTipo?.startsWith('image/')}
            <img src="/admin/entrega-chaves/{a.id}/identidade" alt="Documento de identidade" class="w-full max-h-[28rem] object-contain rounded-lg border border-gray-100 bg-gray-50" />
          {/if}
          <a href="/admin/entrega-chaves/{a.id}/identidade" target="_blank" rel="noopener" class="inline-block mt-2 text-xs font-bold text-calper-red">Abrir em nova aba</a>
        </div>
      {/if}

      <div>
        <label for="email" class="block text-xs font-semibold text-gray-500 mb-1">
          E-mail de quem retira (usado na assinatura)
        </label>
        <input id="email" name="email" type="email" class="input !py-2 text-sm" value={a.retiranteEmail ?? a.email ?? ''} required />
      </div>

      <div class="border border-gray-100 rounded-xl p-4 flex flex-col gap-3">
        <div class="text-xs font-bold text-gray-500">
          Cônjuge que também assina (opcional) — recebe o próprio link do DocuSign por e-mail
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label for="conjugeNome" class="block text-xs font-semibold text-gray-500 mb-1">Nome completo do cônjuge</label>
            <input id="conjugeNome" name="conjugeNome" class="input !py-2 text-sm" value={a.conjugeNome ?? ''} />
          </div>
          <div>
            <label for="conjugeEmail" class="block text-xs font-semibold text-gray-500 mb-1">E-mail do cônjuge</label>
            <input id="conjugeEmail" name="conjugeEmail" type="email" class="input !py-2 text-sm" value={a.conjugeEmail ?? ''} />
          </div>
        </div>
      </div>

      <!-- observações livres do atendimento: vão para o resumo final e para os CSVs -->
      <div class="border border-gray-100 rounded-xl p-4 flex flex-col gap-2">
        <label for="observacoes" class="text-xs font-bold text-gray-500">Observações do atendimento (opcional)</label>
        <textarea id="observacoes" name="observacoes" rows="3" maxlength="2000" class="input text-sm" placeholder="Ex.: cliente pediu uma via extra das chaves; combinou retornar para a vistoria...">{a.observacoes}</textarea>
        <div class="flex items-center gap-3 text-xs">
          <button type="submit" formaction="?/salvarObservacoes" formnovalidate class="font-bold text-calper-red">Salvar observações</button>
          {#if form?.sucesso === 'observacoes'}<span class="text-green-700 font-semibold">Observações salvas.</span>{/if}
        </div>
      </div>

      <div class="flex gap-2">
        <a href={href(1)} class="btn-outline text-center flex-1">Voltar</a>
        <div class="flex-1"><SubmitButton loading={enviando}>Confirmar e continuar</SubmitButton></div>
      </div>
      {#if data.retirante}
        <a href={href(3)} class="text-center text-sm text-gray-500">Avançar sem alterar →</a>
      {/if}
    </form>

    <!-- PASSO 3 — termo (cria o envelope; a Calper assina primeiro) -->
  {:else if data.passo === 3}
    {#if calperJaAssinou.includes(data.documentos.termo)}
      {@render andamento('termo', 'Termo', 4, 'Seguir para o checklist')}
      {#if data.documentos.termo !== 'assinado'}{@render corrigirEmail('termo')}{/if}
    {:else}
      <form method="POST" action="?/enviar" use:enhance={aoPedirDocumento} class="card p-6 flex flex-col gap-3">
        <input type="hidden" name="tipo" value="termo" />
        {@render quemAssina('termo')}
        <textarea name="texto" rows="26" class="input text-sm font-mono" required>{data.texto}</textarea>
        <p class="text-xs text-gray-400">
          Revise e corrija o texto. Variáveis como {'{{numeroCertidao}}'} precisam ser preenchidas antes do envio.
        </p>
        {@render botoesDocumento('termo', href(2), href(4))}
        {@render leitura('termo')}
      </form>
      {@render corrigirEmail('termo')}
    {/if}

    <!-- PASSO 4 — checklist (anexado ao mesmo envelope do termo) -->
  {:else if data.passo === 4}
    {#if calperJaAssinou.includes(data.documentos.checklist)}
      {@render andamento('checklist', 'Checklist', 5, 'Ver resumo da entrega')}
      {#if data.documentos.checklist !== 'assinado'}{@render corrigirEmail('checklist')}{/if}
    {:else}
      <form method="POST" action="?/enviar" use:enhance={aoPedirDocumento} class="card p-6 flex flex-col gap-4">
        <input type="hidden" name="tipo" value="checklist" />
        <input type="hidden" name="cabecalho" value={data.checklist.cabecalho} />
        <input type="hidden" name="rodape" value={data.checklist.rodape} />

        {@render quemAssina('checklist')}
        {#if !u.quartos}
          <AvisoSutil>Tipologia não informada: preencha a quantidade de chaves de porta interior.</AvisoSutil>
        {/if}

        {#each data.checklist.itens as item (item.numero)}
          <div class="border border-gray-100 rounded-xl p-3 flex flex-col gap-2">
            <input type="hidden" name="numero" value={item.numero} />
            <input type="hidden" name="descricao" value={item.descricao} />
            <input type="hidden" name="temQtde" value={item.temQtde ? '1' : '0'} />
            <div class="text-sm text-calper-dark">{item.numero}. {item.descricao}</div>
            <div class="flex items-center gap-4 text-sm">
              {#if item.temQtde}
                <label class="flex items-center gap-1.5 text-xs font-semibold text-gray-500">
                  Qtde.
                  <input name="qtde" value={item.qtde} class="input !py-1.5 !w-20 text-sm" />
                </label>
              {:else}
                <input type="hidden" name="qtde" value="" />
              {/if}
              <label class="flex items-center gap-1.5">
                <input type="radio" name="recebido_{item.numero}" value="sim" checked required /> Sim
              </label>
              <label class="flex items-center gap-1.5">
                <input type="radio" name="recebido_{item.numero}" value="nao" /> Não
              </label>
            </div>
          </div>
        {/each}

        {@render botoesDocumento('checklist', href(3), href(5))}
        {@render leitura('checklist')}
      </form>
      {@render corrigirEmail('checklist')}
    {/if}

    <!-- PASSO 5 — concluído + download -->
  {:else}
    <div class="card p-6 flex flex-col gap-3">
      {#if a.status === 'realizado'}
        <div class="rounded-xl bg-green-50 border border-green-100 px-4 py-3 text-sm text-green-800">
          <div class="font-bold">Entrega concluída</div>
          <div class="text-xs mt-1 text-green-700">
            {#if a.concluidaEm}Assinada por todos em {new Date(a.concluidaEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}. {/if}Agendada para {formatarDataHora(a.dataHora)}.
          </div>
        </div>
        <dl class="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div>
            <dt class="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Agendou</dt>
            <dd class="font-semibold text-calper-dark">{a.nome ?? '—'}</dd>
          </div>
          <div>
            <dt class="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Retirou as chaves</dt>
            <dd class="font-semibold text-calper-dark">{data.retirante?.nome ?? a.retiranteNome ?? '—'}</dd>
          </div>
          {#if data.conjuge}
            <div>
              <dt class="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Cônjuge</dt>
              <dd class="font-semibold text-calper-dark">{data.conjuge.nome}</dd>
            </div>
          {/if}
        </dl>
      {/if}
      <div class="text-sm font-bold text-calper-dark">Documentos</div>
      {#if data.documentos.termo === 'assinado' && data.documentos.checklist === 'assinado'}
        <LinkDownload
          href="/admin/entrega-chaves/{a.id}/documento/completo"
          class="btn-primary text-center inline-block"
        >Baixar PDF completo (termo + checklist assinados)</LinkDownload>
      {/if}
      {#each [['termo', 'Termo de entrega de chaves', 3], ['checklist', 'Checklist', 4]] as [tipo, rotulo, passo]}
        <div class="flex items-center justify-between border border-gray-100 rounded-xl p-3">
          <div>
            <div class="text-sm font-semibold text-calper-dark">{rotulo}</div>
            <div class="text-xs {data.documentos[tipo] === 'assinado' ? 'text-green-700' : 'text-amber-700'}">
              {rotuloStatus[data.documentos[tipo]] ?? 'Não enviado'}
            </div>
          </div>
          {#if data.documentos[tipo] === 'assinado'}
            <LinkDownload
              href="/admin/entrega-chaves/{a.id}/documento/{tipo}"
              class="text-xs font-bold text-white bg-calper-red px-3 py-2 rounded-lg inline-block">Baixar PDF</LinkDownload
            >
          {:else}
            <a href={href(passo)} class="text-xs font-bold text-calper-red">Ver</a>
          {/if}
        </div>
      {/each}

      <div class="text-sm font-bold text-calper-dark mt-3">Lista de presença</div>
      {#each data.presencas as p (p.id)}
        <div class="text-sm text-calper-dark">
          {p.nome} <span class="text-xs text-gray-500">— {p.vinculoRotulo}, {formatarHora(p.createdAt)}</span>
        </div>
      {:else}
        <p class="text-sm text-gray-400">Ninguém registrado.</p>
      {/each}
      {#if a.observacoes}
        <div class="text-sm font-bold text-calper-dark mt-3">Observações do atendimento</div>
        <p class="text-sm text-calper-dark whitespace-pre-line border border-gray-100 rounded-xl p-3" data-testid="observacoes-resumo">{a.observacoes}</p>
      {/if}
      <div class="flex gap-2 text-sm text-gray-500 mt-2">
        <a href={href(4)} class="flex-1 text-center">← Voltar</a>
        <a href={href(2)} class="flex-1 text-center">Editar observações</a>
      </div>
    </div>
  {/if}
</div>

{#snippet quemAssina(tipo)}
  <div class="text-sm text-gray-600">
    Calper assina primeiro; depois recebem o link por e-mail:
    <strong>{data.signatario.nome ?? '—'}</strong> ({data.signatario.email ?? 'sem e-mail'}){#if data.conjuge}{' '}
      e <strong>{data.conjuge.nome}</strong> ({data.conjuge.email}){/if}
    {#if data.documentos[tipo] === 'pendente'}
      <span class="ml-2 text-xs font-bold px-2 py-0.5 rounded-full {alerta}">assinatura da Calper pendente</span>
    {/if}
  </div>
{/snippet}

{#snippet botoesDocumento(tipo, voltar, avancar)}
  <div class="flex flex-col gap-2">
    <button
      type="submit"
      formaction="?/previa"
      disabled={gerandoPrevia}
      class="btn-primary text-center disabled:opacity-60"
    >
      {gerandoPrevia ? 'Gerando o documento…' : 'Cliente: ler o documento'}
    </button>
    {#if data.documentos[tipo] === 'pendente'}
      <a href="/admin/entrega-chaves/{a.id}/assinar?tipo={tipo}&origem=fluxo" class="btn-outline text-center">
        Continuar a assinatura da Calper
      </a>
    {/if}
    <div class="flex gap-2 text-sm text-gray-500">
      <a href={voltar} class="flex-1 text-center">← Voltar</a>
      <a href={avancar} class="flex-1 text-center">Avançar →</a>
    </div>
  </div>
{/snippet}

<!-- tela de leitura (somente leitura): o cliente lê no iPad do atendimento; só depois a Calper assina -->
{#snippet leitura(tipo)}
  {#if previa?.tipo === tipo}
    <div class="fixed inset-0 z-50 bg-white flex flex-col">
      <div class="px-4 py-3 border-b border-gray-100 text-sm font-bold text-calper-dark">
        Leitura — {tipo === 'termo' ? 'Termo de entrega de chaves' : 'Checklist'} (somente leitura)
      </div>
      <iframe src={previa.url} title="Leitura do documento" class="flex-1 w-full border-0"></iframe>
      <div class="p-3 border-t border-gray-100 flex flex-col sm:flex-row gap-2">
        <button type="button" class="btn-outline flex-1" onclick={fecharPrevia}>Voltar e corrigir</button>
        <button type="submit" formaction="?/enviar" disabled={enviando} class="btn-primary flex-1 disabled:opacity-60">
          {enviando ? 'Enviando…' : 'Cliente leu — assinar pela Calper'}
        </button>
      </div>
    </div>
  {/if}
{/snippet}

{#snippet andamento(tipo, rotulo, proximoPasso, rotuloProximo)}
  <div class="card p-6 flex flex-col gap-4">
    {#if data.documentos[tipo] === 'assinado'}
      <div class="text-sm font-bold text-green-700">{rotulo}: assinado por todos.</div>
      <a href={href(proximoPasso)} class="btn-primary text-center">{rotuloProximo}</a>
    {:else if data.documentos[tipo] === 'calper_assinou'}
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-xs font-bold px-2.5 py-1 rounded-full {alerta}">Calper assinou o {rotulo.toLowerCase()}</span>
      </div>
      <p class="text-sm text-gray-600">
        ✔ A Calper assinou. O cliente{data.conjuge ? ' e o cônjuge' : ''} ainda <strong>não receberam</strong> e-mail: eles recebem
        <strong>um único e-mail com o termo e o checklist</strong>, logo depois que a Calper assinar também o checklist.
      </p>
      <a href={href(proximoPasso)} class="btn-primary text-center">{rotuloProximo}</a>
    {:else}
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-xs font-bold px-2.5 py-1 rounded-full {alerta}">Calper assinou — aguardando o cliente</span>
        <span class="text-sm font-bold text-calper-dark">{rotulo}</span>
      </div>
      <div class="text-sm text-gray-600 flex flex-col gap-2">
        <div>✔ A Calper assinou o termo e o checklist. O DocuSign enviou um único e-mail (com os dois documentos) para:</div>
        <ul class="flex flex-col gap-1.5">
          {#each [{ nome: data.signatario.nome, email: data.signatario.email, papel: 'cliente' }, ...(data.conjuge ? [{ nome: data.conjuge.nome, email: data.conjuge.email, papel: 'cônjuge' }] : [])] as p (p.email)}
            {@const falta = data.pendentes[tipo]?.some((c) => c.email?.toLowerCase() === p.email?.toLowerCase())}
            <li class="flex flex-wrap items-center gap-x-2 border border-gray-100 rounded-xl px-3 py-2">
              <span class="font-semibold text-calper-dark">{p.nome}</span>
              <span class="text-xs text-gray-500">({p.papel}) · {p.email}</span>
              <span class="ml-auto text-xs font-bold {falta === false ? 'text-green-700' : 'text-amber-700'}">
                {falta === false ? 'assinou' : 'ainda não assinou'}
              </span>
            </li>
          {/each}
        </ul>
        <p class="text-xs text-gray-400">
          Cada um assina no próprio dispositivo, pelo link do e-mail. Se não chegou, peça para olhar o spam.
        </p>
      </div>

      <form method="POST" action="?/verificar" use:enhance={aoEnviar} class="flex flex-col gap-2">
        <input type="hidden" name="tipo" value={tipo} />
        <SubmitButton loading={enviando}>Verificar agora no DocuSign</SubmitButton>
      </form>
      <a href={href(proximoPasso)} class="btn-outline text-center">{rotuloProximo}</a>
    {/if}
  </div>
{/snippet}

<!-- "Corrigir e-mail": abaixo do botão de avançar nas etapas em que se espera a assinatura (também com o envelope já enviado) -->
{#snippet corrigirEmail(tipo)}
  <div class="mt-3" data-testid="corrigir-email">
    {#if !abrirCorrecao}
      <button type="button" class="w-full text-center text-sm font-semibold text-gray-600 hover:text-calper-red border border-gray-200 rounded-xl py-2.5" onclick={() => (abrirCorrecao = true)}>
        Corrigir e-mail
      </button>
    {:else}
      <form method="POST" action="?/corrigirEmail" use:enhance={() => async ({ update }) => { await update({ reset: false }); }} class="card p-5 flex flex-col gap-3">
        <div class="text-sm font-bold text-calper-dark">Corrigir e-mail de quem assina</div>
        <p class="text-xs text-gray-500">
          Atualiza o cadastro e corrige o destinatário no DocuSign: o link enviado ao e-mail antigo deixa de valer e,
          se o e-mail já tinha sido enviado, o DocuSign reenvia ao endereço novo.
        </p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label class="flex flex-col gap-1">
            <span class="text-xs font-semibold text-gray-500">De quem?</span>
            <select name="quem" class="input !py-2 text-sm">
              <option value="cliente">{data.signatario.nome ?? 'Quem retira'} — {data.signatario.email ?? 'sem e-mail'}</option>
              {#if data.conjuge}<option value="conjuge">{data.conjuge.nome} (cônjuge) — {data.conjuge.email}</option>{/if}
            </select>
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs font-semibold text-gray-500">E-mail correto</span>
            <input name="email" type="email" class="input !py-2 text-sm" required />
          </label>
        </div>
        {#if form?.erroEmail}<AvisoSutil>{form.erroEmail}</AvisoSutil>{/if}
        {#if form?.sucessoEmail}<p class="text-sm text-green-700 font-semibold">{form.sucessoEmail}</p>{/if}
        <div class="flex items-center gap-3">
          <button type="submit" class="btn-primary !py-2 !px-4 text-sm">Salvar e-mail</button>
          <button type="button" class="text-sm font-semibold text-gray-500" onclick={() => (abrirCorrecao = false)}>Fechar</button>
        </div>
      </form>
    {/if}
  </div>
{/snippet}
