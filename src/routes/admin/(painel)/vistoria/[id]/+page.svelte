<script>
  import LinkDownload from '$lib/components/LinkDownload.svelte';
  import { enhance } from '$app/forms';
  import SubmitButton from '$lib/components/SubmitButton.svelte';
  import AvisoSutil from '$lib/components/AvisoSutil.svelte';
  import UnidadeStatus from '$lib/components/UnidadeStatus.svelte';
  import { formatarCpf } from '$lib/cpf.js';
  import { fotosParaPdf } from '$lib/fotoParaPdf.js';

  let { data, form } = $props();

  let u = $derived(data.unidade);
  let a = $derived(data.agendamento);
  let enviando = $state(false);
  let abrirCorrecao = $state(false);
  const travada = $derived(a.status === 'cancelado' || a.status === 'realizado');

  const passos = ['Quem comparece', 'Vistoria', 'Resultado', 'Termo', 'Concluído'];
  const href = (passo) => `?passo=${passo}`;

  // etapa 1: quem comparece
  const presenteDe = (nome) => data.presentes.find((p) => p.nome === nome && p.vinculo !== 'procurador');
  let marcados = $state({});
  let emails = $state({});
  $effect(() => {
    for (const t of data.titulares) {
      const p = presenteDe(t.nome);
      marcados[t.id] = Boolean(p);
      emails[t.id] = p?.email ?? t.emailSugerido ?? '';
    }
  });
  const procuradorSalvo = $derived(data.presentes.find((p) => p.vinculo === 'procurador') ?? null);
  let comProcurador = $state(false);
  $effect(() => {
    comProcurador = Boolean(procuradorSalvo);
  });
  let cpfDigitado = $state(null);
  let arquivo = $state(null);
  let inputProcuracao = $state(null);
  let fotos = $state([]);
  let convertendo = $state(false);
  let erroProcuracao = $state('');
  const cpfProcurador = $derived((cpfDigitado ?? procuradorSalvo?.cpf ?? '').replace(/\D/g, ''));
  const procuracaoVale = $derived(a.temProcuracao && (!a.procuracaoCpf || a.procuracaoCpf === cpfProcurador));
  let tentouSalvar = $state(false);
  const faltaProcuracao = $derived(tentouSalvar && comProcurador && !arquivo && !procuracaoVale);

  function colocarArquivo(file) {
    const dt = new DataTransfer();
    if (file) dt.items.add(file);
    inputProcuracao.files = dt.files;
    arquivo = file;
  }
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
  function aoSalvarPresentes({ cancel }) {
    tentouSalvar = true;
    if (comProcurador && !arquivo && !procuracaoVale) {
      cancel();
      return;
    }
    return aoEnviar();
  }

  // etapa 3
  let resultado = $state('');
  $effect(() => {
    resultado = a.resultado ?? '';
  });

  // etapa 4 e revistoria
  let previa = $state(null);
  let gerandoPrevia = $state(false);
  let quandoRevistoria = $state('agora');
  let dataRevistoria = $state('');
  const horariosDoDia = $derived(data.revistoria.agenda.find((d) => d.data === dataRevistoria)?.horarios.filter((h) => h.restantes > 0) ?? []);

  function aoEnviar() {
    enviando = true;
    return async ({ update }) => {
      await update({ reset: false });
      enviando = false;
    };
  }
  function aoPedirDocumento({ action }) {
    if (!action.search.includes('previa')) return aoEnviar();
    gerandoPrevia = true;
    return async ({ result, update }) => {
      gerandoPrevia = false;
      if (result.type === 'success' && result.data?.previa) {
        const bytes = Uint8Array.from(atob(result.data.previa.pdfBase64), (c) => c.charCodeAt(0));
        previa = { url: URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })) };
      } else {
        await update({ reset: false });
      }
    };
  }
  function fecharPrevia() {
    if (previa) URL.revokeObjectURL(previa.url);
    previa = null;
  }

  function formatarDataHora(iso) {
    return new Date(iso).toLocaleString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  const rotuloVinculo = { comprador_principal: 'Comprador principal', comprador: 'Comprador', procurador: 'Procurador' };
  const rotuloStatus = {
    pendente: 'Aguardando a assinatura da Calper',
    aguardando_cliente: 'Calper assinou — aguardando os proprietários',
    assinado: 'Assinado por todos'
  };
  const alerta = 'bg-amber-50 text-amber-700';
  const corResultado = $derived(
    a.resultado === 'aceita' && a.status === 'realizado' ? 'bg-green-50 text-green-700' : a.resultado === 'nao_aceita' ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'
  );
</script>

<svelte:head>
  <title>Vistoria — Bloco {u.bloco} nº {u.numero}</title>
</svelte:head>

<div class="p-5 md:p-8 max-w-3xl">
  <a href="/admin/vistoria" class="text-sm text-gray-500 hover:text-calper-dark">← Vistoria</a>
  <h1 class="text-xl font-bold text-calper-dark mt-3 mb-1">Bloco {u.bloco} - nº {u.numero}</h1>
  <p class="text-sm text-gray-500 flex flex-wrap items-center gap-1.5">
    <span class="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{a.vistoriaNumero}ª vistoria</span>
    {#if a.origem === 'atendimento_direto'}
      <span class="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700" data-testid="selo-direto">Atendimento direto</span>
      iniciado em {formatarDataHora(a.dataHora)}
    {:else}
      Agendada para {formatarDataHora(a.dataHora)}
    {/if}
    <span class="text-xs font-bold px-2 py-0.5 rounded-full {corResultado}" data-testid="resultado-vistoria">{a.resultadoRotulo}</span>
  </p>
  {#if a.status === 'cancelado'}
    <div class="rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-3 my-3" data-testid="banner-cancelado">
      <strong>Agendamento desmarcado.</strong>{#if a.motivoCancelamento} Motivo: {a.motivoCancelamento}{/if}
      <div class="text-xs mt-1">O registro foi mantido; o atendimento não pode mais ser alterado.</div>
    </div>
  {/if}
  <p class="text-xs text-gray-500 mt-1 mb-5">
    {#if a.origem !== 'atendimento_direto'}Agendamento feito por <strong>{a.nome ?? '—'}</strong>{a.email ? ` (${a.email})` : ''}{/if}
    {#if data.presentes.length}· Comparece: <strong>{data.presentes.map((p) => p.nome).join(', ')}</strong>{/if}
  </p>

  <ol class="flex flex-wrap gap-1.5 mb-6 text-[11px] font-bold" aria-label="Etapas do atendimento">
    {#each passos as nome, i}
      <li>
        <a href={href(i + 1)} aria-current={data.passo === i + 1 ? 'step' : undefined} class="inline-block px-2.5 py-1 rounded-full {data.passo === i + 1 ? 'bg-calper-red text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}">
          {i + 1}. {nome}
        </a>
      </li>
    {/each}
  </ol>

  {#if data.bloqueio && data.passo >= 2 && data.passo <= 4}
    <div class="card p-6 flex flex-col gap-3" data-testid="etapa-bloqueada">
      <div class="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">{data.bloqueio.texto}</div>
      <a href={href(data.bloqueio.passo)} class="btn-primary text-center">{data.bloqueio.rotulo}</a>
    </div>
  {/if}

  {#if form?.erro}<div class="mb-4"><AvisoSutil>{form.erro}</AvisoSutil></div>{/if}
  {#if data.aviso === 'nao-assinado'}
    <div class="mb-4"><AvisoSutil>A assinatura da Calper não foi concluída. Continue de onde parou para assinar.</AvisoSutil></div>
  {/if}
  {#if form?.verificado}
    <div class="mb-4 text-sm font-semibold rounded-xl px-4 py-3 {form.verificado.status === 'assinado' ? 'text-green-700 bg-green-50 border border-green-100' : 'text-amber-700 bg-amber-50 border border-amber-100'}">
      {form.verificado.status === 'assinado' ? 'Verificado agora no DocuSign: todos assinaram.' : 'Verificado agora no DocuSign: ainda aguardando assinaturas.'}
    </div>
  {/if}

  {#if data.bloqueio && data.passo >= 2 && data.passo <= 4}
    <!-- (etapa bloqueada: o aviso está acima) -->

  <!-- ETAPA 1 — quem comparece -->
  {:else if data.passo === 1}
    <form method="POST" action="?/salvarPresentes" enctype="multipart/form-data" use:enhance={aoSalvarPresentes} class="card p-6 flex flex-col gap-4" data-testid="form-presentes">
      <div class="text-sm font-bold text-calper-dark">Situação da unidade</div>
      <UnidadeStatus unidade={u} podeEditar={data.podeEditar} />

      <div class="text-sm font-bold text-calper-dark mt-2">Quem comparece à vistoria?</div>
      <p class="text-xs text-gray-500 -mt-2">Marque todos os compradores presentes: cada um assina o termo (se a vistoria for aceita) e recebe o próprio link por e-mail.</p>
      {#if data.titulares.length === 0}
        <div class="border border-amber-200 bg-amber-50 text-amber-800 text-sm rounded-xl p-3">
          Nenhum comprador cadastrado para esta unidade. Quem comparece precisa apresentar procuração.
        </div>
      {/if}
      {#each data.titulares as t (t.id)}
        <div class="border border-gray-100 rounded-xl p-3 flex flex-col gap-2">
          <label class="flex items-center gap-2.5 text-sm text-calper-dark">
            <input type="checkbox" name="presente" value={t.id} bind:checked={marcados[t.id]} disabled={travada} />
            <span>{t.nome}{#if t.principal}<span class="text-[11px] font-bold text-calper-red ml-1">principal</span>{/if}</span>
          </label>
          {#if marcados[t.id]}
            <input name="email_{t.id}" type="email" class="input !py-2 text-sm" placeholder="E-mail para a assinatura" bind:value={emails[t.id]} disabled={travada} />
          {/if}
        </div>
      {/each}

      <label class="flex items-center gap-2.5 text-sm text-calper-dark border border-gray-100 rounded-xl p-3">
        <input type="checkbox" name="procurador" value="sim" bind:checked={comProcurador} disabled={travada} />
        <span>Procurador comparece — exige procuração. Se houver compradores presentes, o procurador também assina.</span>
      </label>
      {#if comProcurador}
        <div class="border border-gray-200 rounded-xl p-4 flex flex-col gap-3">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label for="procNome" class="block text-xs font-semibold text-gray-500 mb-1">Nome completo do procurador</label>
              <input id="procNome" name="procNome" class="input !py-2 text-sm" value={procuradorSalvo?.nome ?? ''} required />
            </div>
            <div>
              <label for="procCpf" class="block text-xs font-semibold text-gray-500 mb-1">CPF do procurador</label>
              <input id="procCpf" name="procCpf" inputmode="numeric" class="input !py-2 text-sm" value={procuradorSalvo?.cpf ? formatarCpf(procuradorSalvo.cpf) : (a.procuracaoCpf ? formatarCpf(a.procuracaoCpf) : '')} oninput={(e) => (cpfDigitado = e.currentTarget.value)} required />
            </div>
          </div>
          <div>
            <label for="procEmail" class="block text-xs font-semibold text-gray-500 mb-1">E-mail do procurador (usado na assinatura)</label>
            <input id="procEmail" name="procEmail" type="email" class="input !py-2 text-sm" value={procuradorSalvo?.email ?? ''} />
          </div>
          {#if a.ehProprietario === false}
            <div class="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-calper-dark">
              <span class="text-xs font-bold text-amber-800 tracking-wide uppercase block mb-0.5">Agendado por quem não é o proprietário</span>
              <strong>{a.nome ?? '—'}</strong>{#if a.proprietarioNome}<span class="block mt-1 text-gray-600">Proprietário: <strong>{a.proprietarioNome}</strong></span>{/if}
            </div>
          {/if}
          {#if a.temProcuracao}
            <a href="/admin/entrega-chaves/{a.id}/procuracao" target="_blank" rel="noopener" class="inline-block text-sm font-bold text-calper-red border border-gray-200 rounded-lg px-4 py-2.5">Abrir a procuração anexada em nova aba</a>
            {#if !procuracaoVale}<AvisoSutil>A procuração anexada é de outra pessoa (CPF {a.procuracaoCpf ? formatarCpf(a.procuracaoCpf) : '—'}): anexe a do procurador que comparece.</AvisoSutil>{/if}
          {/if}
          <div>
            <label for="procuracao" class="block text-xs font-semibold text-gray-500 mb-1">{procuracaoVale ? 'Substituir procuração (opcional)' : 'Procuração (PDF, DOC ou DOCX, até 4 MB) — obrigatória'}</label>
            <input bind:this={inputProcuracao} id="procuracao" name="procuracao" type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" class="input" onchange={aoEscolherArquivo} />
            <div class="mt-2.5 flex flex-wrap items-center gap-2">
              <label class="inline-flex items-center gap-2 text-sm font-bold text-calper-red border border-gray-200 rounded-xl px-3.5 py-2.5 cursor-pointer active:scale-95">
                {fotos.length ? 'Adicionar outra página' : 'Tirar foto da procuração'}
                <input type="file" accept="image/*" capture="environment" class="hidden" data-converte-antes onchange={aoTirarFoto} />
              </label>
              {#if convertendo}<span class="text-xs text-gray-500">Convertendo em PDF…</span>
              {:else if fotos.length}
                <span class="text-xs text-gray-600">{fotos.length} foto(s) → PDF</span>
                <button type="button" class="text-xs font-semibold text-gray-500 underline" onclick={limparFotos}>descartar fotos</button>
              {/if}
            </div>
            {#if erroProcuracao}<div class="mt-2.5"><AvisoSutil>{erroProcuracao}</AvisoSutil></div>{/if}
            {#if faltaProcuracao}<div class="mt-2.5"><AvisoSutil>Procurador comparece: envie a procuração para continuar.</AvisoSutil></div>{/if}
          </div>
        </div>
      {/if}

      {#if a.temIdentidade}
        <div class="rounded-xl border border-gray-200 px-4 py-3 text-sm">
          <div class="text-xs font-bold text-gray-500 mb-1.5">Documento de identidade enviado no agendamento ({a.nome ?? '—'})</div>
          <a href="/admin/entrega-chaves/{a.id}/identidade" target="_blank" rel="noopener" class="text-xs font-bold text-calper-red">Abrir em nova aba</a>
        </div>
      {/if}

      {#if !travada}
        <div class="flex gap-2">
          <a href="/admin/vistoria" class="btn-outline text-center flex-1">Voltar</a>
          <div class="flex-1"><SubmitButton loading={enviando}>Confirmar e continuar</SubmitButton></div>
        </div>
      {/if}
      {#if data.presentes.length}<a href={href(2)} class="text-center text-sm text-gray-500">Avançar sem alterar →</a>{/if}
    </form>

  <!-- ETAPA 2 — vistoria no apartamento -->
  {:else if data.passo === 2}
    <div class="card p-6 flex flex-col gap-4" data-testid="etapa-vistoria">
      <div class="text-sm font-bold text-calper-dark">Vistoria no apartamento</div>
      <p class="text-sm text-gray-600">Faça a vistoria com {data.presentes.map((p) => p.nome).join(', ')} no apartamento. Anote abaixo o que for útil; o resultado é registrado na próxima etapa.</p>
      <form method="POST" action="?/salvarObservacoes" use:enhance={() => async ({ update }) => update({ reset: false })} class="flex flex-col gap-2">
        <label for="observacoes" class="text-xs font-semibold text-gray-500">Observações do atendimento</label>
        <textarea id="observacoes" name="observacoes" rows="4" maxlength="2000" class="input text-sm">{a.observacoes}</textarea>
        <div class="flex items-center gap-3 text-xs">
          <button type="submit" class="btn-outline !py-2 !px-4 text-sm">Salvar observações</button>
          {#if form?.sucesso === 'observacoes'}<span class="text-green-700 font-semibold">Observações salvas.</span>{/if}
        </div>
      </form>
      <div class="flex gap-2 text-sm text-gray-500">
        <a href={href(1)} class="flex-1 text-center">← Voltar</a>
        <a href={href(3)} class="btn-primary flex-1 text-center">Vistoria feita: registrar o resultado</a>
      </div>
    </div>

  <!-- ETAPA 3 — resultado -->
  {:else if data.passo === 3}
    <form method="POST" action="?/registrarResultado" use:enhance={aoEnviar} class="card p-6 flex flex-col gap-4" data-testid="form-resultado">
      <div class="text-sm font-bold text-calper-dark">Resultado da vistoria</div>
      {#if travada}
        <div class="rounded-xl border border-gray-200 px-4 py-3 text-sm text-calper-dark" data-testid="resultado-registrado">
          <strong>{a.resultadoRotulo}</strong>
          {#if a.resultado === 'nao_aceita'}
            <div class="mt-2 text-gray-700 whitespace-pre-line">{a.reparos}</div>
            <div class="mt-1 text-xs text-gray-500">Telefone para contato: {a.telefoneRetorno}</div>
          {/if}
        </div>
      {:else}
        <label class="flex items-center gap-2.5 text-sm text-calper-dark border border-gray-100 rounded-xl p-3">
          <input type="radio" name="resultado" value="aceita" bind:group={resultado} required /> <span><strong>Aceita</strong> — segue para o Termo de Recebimento do Imóvel</span>
        </label>
        <label class="flex items-center gap-2.5 text-sm text-calper-dark border border-gray-100 rounded-xl p-3">
          <input type="radio" name="resultado" value="nao_aceita" bind:group={resultado} required /> <span><strong>Não aceita</strong> — reparos necessários, sem documento e sem assinatura</span>
        </label>
        {#if resultado === 'nao_aceita'}
          <div class="border border-gray-200 rounded-xl p-4 flex flex-col gap-3">
            <div>
              <label for="reparos" class="block text-xs font-semibold text-gray-500 mb-1">Reparos necessários (obrigatório)</label>
              <textarea id="reparos" name="reparos" rows="6" maxlength="4000" class="input text-sm" required>{a.reparos}</textarea>
            </div>
            <div>
              <label for="telefoneRetorno" class="block text-xs font-semibold text-gray-500 mb-1">Telefone para contato (obrigatório)</label>
              <input id="telefoneRetorno" name="telefoneRetorno" class="input !py-2 text-sm" value={a.telefoneRetorno} required />
            </div>
            <p class="text-xs text-gray-500">Ao registrar, a vistoria é encerrada como "Vistoria não aceita". Admin e supervisor abrem a revistoria depois.</p>
          </div>
        {/if}
        <div class="flex gap-2">
          <a href={href(2)} class="btn-outline text-center flex-1">Voltar</a>
          <div class="flex-1"><SubmitButton loading={enviando}>Registrar resultado</SubmitButton></div>
        </div>
      {/if}
      {#if a.resultado === 'aceita'}<a href={href(4)} class="text-center text-sm text-gray-500">Ir para o termo →</a>{/if}
    </form>

  <!-- ETAPA 4 — termo (a Calper assina primeiro, depois os proprietários) -->
  {:else if data.passo === 4}
    {#if data.documento && data.documento.status !== 'pendente'}
      {@render andamento()}
      {#if data.documento.status !== 'assinado'}{@render corrigirEmail()}{/if}
    {:else}
      <form method="POST" action="?/enviar" use:enhance={aoPedirDocumento} class="card p-6 flex flex-col gap-3">
        {@render quemAssina()}
        <textarea name="texto" rows="24" class="input text-sm font-mono" required>{data.texto}</textarea>
        <p class="text-xs text-gray-400">Revise e corrija o texto antes de enviar. Variáveis como {'{{variavel}}'} precisam ser preenchidas.</p>
        <div class="flex flex-col gap-2">
          <button type="submit" formaction="?/previa" disabled={gerandoPrevia} class="btn-primary text-center disabled:opacity-60">
            {gerandoPrevia ? 'Gerando o documento…' : 'Cliente: ler o documento'}
          </button>
          {#if data.documento?.status === 'pendente'}
            <a href="/admin/vistoria/{a.id}/assinar" class="btn-outline text-center">Continuar a assinatura da Calper</a>
          {/if}
          <div class="flex gap-2 text-sm text-gray-500">
            <a href={href(3)} class="flex-1 text-center">← Voltar</a>
            <a href={href(5)} class="flex-1 text-center">Avançar →</a>
          </div>
        </div>
        {#if previa}
          <div class="fixed inset-0 z-50 bg-white flex flex-col">
            <div class="px-4 py-3 border-b border-gray-100 text-sm font-bold text-calper-dark">Leitura — Termo de Recebimento do Imóvel (somente leitura)</div>
            <iframe src={previa.url} title="Leitura do documento" class="flex-1 w-full border-0"></iframe>
            <div class="p-3 border-t border-gray-100 flex flex-col sm:flex-row gap-2">
              <button type="button" class="btn-outline flex-1" onclick={fecharPrevia}>Voltar e corrigir</button>
              <button type="submit" formaction="?/enviar" disabled={enviando} class="btn-primary flex-1 disabled:opacity-60">{enviando ? 'Enviando…' : 'Cliente leu — assinar pela Calper'}</button>
            </div>
          </div>
        {/if}
      </form>
      {@render corrigirEmail()}
    {/if}

  <!-- ETAPA 5 — resumo -->
  {:else}
    <div class="card p-6 flex flex-col gap-3" data-testid="resumo-vistoria">
      <div class="rounded-xl px-4 py-3 text-sm {a.resultado === 'nao_aceita' ? 'bg-red-50 border border-red-100 text-red-800' : a.status === 'realizado' ? 'bg-green-50 border border-green-100 text-green-800' : 'bg-gray-50 border border-gray-100 text-gray-700'}">
        <div class="font-bold">{a.resultadoRotulo}</div>
        <div class="text-xs mt-1">
          {#if a.concluidaEm}Concluída em {new Date(a.concluidaEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}. {/if}{a.vistoriaNumero}ª vistoria de {formatarDataHora(a.dataHora)}.
        </div>
      </div>

      <dl class="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <div>
          <dt class="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Agendou</dt>
          <dd class="font-semibold text-calper-dark">{a.nome ?? '—'}</dd>
        </div>
        <div>
          <dt class="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Atendeu pela Calper</dt>
          <dd class="font-semibold text-calper-dark">{data.calper.nome}</dd>
        </div>
      </dl>

      <div class="text-sm font-bold text-calper-dark mt-1">Quem compareceu</div>
      {#each data.presentes as p}
        <div class="text-sm text-calper-dark">{p.nome} <span class="text-xs text-gray-500">— {rotuloVinculo[p.vinculo] ?? p.vinculo}</span></div>
      {:else}
        <p class="text-sm text-gray-400">Ninguém registrado.</p>
      {/each}

      {#if a.resultado === 'nao_aceita'}
        <div class="text-sm font-bold text-calper-dark mt-1">Reparos necessários</div>
        <div class="text-sm text-gray-700 whitespace-pre-line border border-gray-100 rounded-xl p-3" data-testid="reparos-registrados">{a.reparos}</div>
        <div class="text-xs text-gray-500">Telefone para contato: <strong>{a.telefoneRetorno}</strong></div>
      {:else if a.resultado === 'aceita'}
        <div class="text-sm font-bold text-calper-dark mt-1">Termo de Recebimento do Imóvel</div>
        <div class="flex items-center justify-between border border-gray-100 rounded-xl p-3">
          <div class="text-xs {data.documento?.status === 'assinado' ? 'text-green-700' : 'text-amber-700'}">{rotuloStatus[data.documento?.status] ?? 'Não enviado'}</div>
          {#if data.documento?.status === 'assinado'}
            <LinkDownload href="/admin/vistoria/{a.id}/documento" class="text-xs font-bold text-white bg-calper-red px-3 py-2 rounded-lg inline-block">Baixar PDF</LinkDownload>
          {:else}
            <a href={href(4)} class="text-xs font-bold text-calper-red">Ver</a>
          {/if}
        </div>
      {/if}

      <form method="POST" action="?/salvarObservacoes" use:enhance={() => async ({ update }) => update({ reset: false })} class="border border-gray-100 rounded-xl p-4 flex flex-col gap-2 mt-2" data-testid="observacoes-resumo">
        <label for="observacoes-final" class="text-sm font-bold text-calper-dark">Observações do atendimento</label>
        <textarea id="observacoes-final" name="observacoes" rows="3" maxlength="2000" class="input text-sm">{a.observacoes}</textarea>
        <div class="flex items-center gap-3 text-xs">
          <button type="submit" class="btn-outline !py-2 !px-4 text-sm">Salvar observações</button>
          {#if form?.sucesso === 'observacoes'}<span class="text-green-700 font-semibold">Observações salvas.</span>{/if}
        </div>
      </form>

      {#if a.resultado === 'nao_aceita'}
        <div class="border border-gray-200 rounded-xl p-4 flex flex-col gap-3 mt-2" data-testid="revistoria">
          <div class="text-sm font-bold text-calper-dark">Revistoria</div>
          {#if data.revistoria.proxima}
            <div class="text-sm text-gray-700">Já existe a {data.revistoria.proxima.vistoriaNumero}ª vistoria desta unidade. <a href="/admin/vistoria/{data.revistoria.proxima.id}" class="font-bold text-calper-red" data-testid="ir-revistoria">Abrir →</a></div>
          {:else if !data.revistoria.podeGerir}
            <p class="text-sm text-gray-500" data-testid="revistoria-sem-permissao">Só admin e supervisor abrem a revistoria.</p>
          {:else if data.revistoria.bloqueio}
            <p class="text-sm text-gray-500">{data.revistoria.bloqueio}.</p>
          {:else}
            <form method="POST" action="?/abrirRevistoria" use:enhance={aoEnviar} class="flex flex-col gap-3" data-testid="form-revistoria">
              <label class="flex items-center gap-2.5 text-sm text-calper-dark"><input type="radio" name="quando" value="agora" bind:group={quandoRevistoria} /> Agora (atendimento direto, sem usar vaga da agenda)</label>
              <label class="flex items-center gap-2.5 text-sm text-calper-dark"><input type="radio" name="quando" value="agenda" bind:group={quandoRevistoria} /> Escolher data e horário na agenda de vistoria</label>
              {#if quandoRevistoria === 'agenda'}
                {#if data.revistoria.agenda.length === 0}
                  <p class="text-xs text-amber-700">Não há dias abertos na agenda de vistoria. Abra dias em Agenda vistoria.</p>
                {:else}
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <select name="data" class="input !py-2 text-sm" bind:value={dataRevistoria} required>
                      <option value="">Data</option>
                      {#each data.revistoria.agenda as d}<option value={d.data}>{d.data.split('-').reverse().join('/')}</option>{/each}
                    </select>
                    <select name="horario" class="input !py-2 text-sm" required>
                      <option value="">Horário</option>
                      {#each horariosDoDia as h}<option value={h.horario}>{h.horario} ({h.restantes} vaga{h.restantes > 1 ? 's' : ''})</option>{/each}
                    </select>
                  </div>
                {/if}
              {/if}
              {#if form?.erroRevistoria}<AvisoSutil>{form.erroRevistoria}</AvisoSutil>{/if}
              <SubmitButton loading={enviando}>Abrir revistoria ({a.vistoriaNumero + 1}ª vistoria)</SubmitButton>
            </form>
          {/if}
        </div>
      {/if}
      <div class="flex gap-2 text-sm text-gray-500 mt-2">
        <a href={href(a.resultado === 'aceita' ? 4 : 3)} class="flex-1 text-center">← Voltar</a>
      </div>
    </div>
  {/if}
</div>

{#snippet quemAssina()}
  <div class="text-sm text-gray-600" data-testid="quem-assina">
    {#if data.avisoAssinantes}
      <AvisoSutil>{data.avisoAssinantes}</AvisoSutil>
    {:else}
      Assina primeiro pela Calper: <strong data-testid="assina-calper">{data.calper.nome}</strong> ({data.calper.email}). Depois recebem o link por e-mail:
      <ul class="mt-1 flex flex-col gap-1">
        {#each data.signatarios as s}
          <li data-testid="assinante"><strong>{s.nome}</strong> <span class="text-xs text-gray-500">({rotuloVinculo[s.vinculo] ?? s.vinculo}) · {s.email}</span></li>
        {/each}
      </ul>
    {/if}
    {#if data.documento?.status === 'pendente'}
      <span class="ml-2 text-xs font-bold px-2 py-0.5 rounded-full {alerta}">assinatura da Calper pendente</span>
    {/if}
  </div>
{/snippet}

{#snippet andamento()}
  <div class="card p-6 flex flex-col gap-4">
    {#if data.documento.status === 'assinado'}
      <div class="text-sm font-bold text-green-700">Termo de Recebimento do Imóvel: assinado por todos.</div>
      <a href={href(5)} class="btn-primary text-center">Ver o resumo</a>
    {:else}
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-xs font-bold px-2.5 py-1 rounded-full {alerta}">Calper assinou — aguardando os proprietários</span>
      </div>
      <div class="text-sm text-gray-600 flex flex-col gap-2">
        <div>✔ A Calper assinou. O DocuSign enviou o e-mail com o termo para:</div>
        <ul class="flex flex-col gap-1.5">
          {#each data.signatarios as p (p.email)}
            {@const falta = data.pendentes.some((c) => c.email?.toLowerCase() === p.email?.toLowerCase())}
            <li class="flex flex-wrap items-center gap-x-2 border border-gray-100 rounded-xl px-3 py-2">
              <span class="font-semibold text-calper-dark">{p.nome}</span>
              <span class="text-xs text-gray-500">({rotuloVinculo[p.vinculo] ?? p.vinculo}) · {p.email}</span>
              <span class="ml-auto text-xs font-bold {falta ? 'text-amber-700' : 'text-green-700'}">{falta ? 'ainda não assinou' : 'assinou'}</span>
            </li>
          {/each}
        </ul>
        <p class="text-xs text-gray-400">Cada um assina no próprio dispositivo, pelo link do e-mail. Se não chegou, peça para olhar o spam.</p>
      </div>
      <form method="POST" action="?/verificar" use:enhance={aoEnviar} class="flex flex-col gap-2">
        <SubmitButton loading={enviando}>Verificar agora no DocuSign</SubmitButton>
      </form>
      <a href={href(5)} class="btn-outline text-center">Ver o resumo</a>
    {/if}
  </div>
{/snippet}

{#snippet corrigirEmail()}
  <div class="mt-3" data-testid="corrigir-email">
    {#if !abrirCorrecao}
      <button type="button" class="w-full text-center text-sm font-semibold text-gray-600 hover:text-calper-red border border-gray-200 rounded-xl py-2.5" onclick={() => (abrirCorrecao = true)}>Corrigir e-mail</button>
    {:else}
      <form method="POST" action="?/corrigirEmail" use:enhance={() => async ({ update }) => { await update({ reset: false }); }} class="card p-5 flex flex-col gap-3">
        <div class="text-sm font-bold text-calper-dark">Corrigir e-mail de quem assina</div>
        <p class="text-xs text-gray-500">Atualiza o cadastro e corrige o destinatário no DocuSign: o link enviado ao e-mail antigo deixa de valer.</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label class="flex flex-col gap-1">
            <span class="text-xs font-semibold text-gray-500">De quem?</span>
            <select name="quem" class="input !py-2 text-sm">
              {#each data.signatarios as s, i}<option value={i}>{s.nome} — {s.email}</option>{/each}
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
