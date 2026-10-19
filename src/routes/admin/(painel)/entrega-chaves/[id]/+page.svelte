<script>
  import { enhance } from '$app/forms';
  import SubmitButton from '$lib/components/SubmitButton.svelte';
  import AvisoSutil from '$lib/components/AvisoSutil.svelte';
  import { formatarCpf } from '$lib/cpf.js';

  let { data, form } = $props();

  let u = $derived(data.unidade);
  let a = $derived(data.agendamento);
  let enviando = $state(false);

  // passo 2
  let quem = $state('');
  let arquivo = $state(null);
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
  const href = (passo) => `?passo=${passo}`;

  function aoEnviar() {
    enviando = true;
    return async ({ update }) => {
      await update({ reset: false });
      enviando = false;
    };
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

  <ol class="flex flex-wrap gap-1.5 mb-6 text-[11px] font-bold">
    {#each passos as nome, i}
      <li
        class="px-2.5 py-1 rounded-full {data.passo === i + 1
          ? 'bg-calper-red text-white'
          : 'bg-gray-100 text-gray-500'}"
      >
        {i + 1}. {nome}
      </li>
    {/each}
  </ol>

  {#if form?.erro}
    <div class="mb-4"><AvisoSutil>{form.erro}</AvisoSutil></div>
  {/if}
  {#if data.aviso === 'nao-assinado'}
    <div class="mb-4"><AvisoSutil>A assinatura não foi concluída. Envie novamente para assinar.</AvisoSutil></div>
  {/if}

  <!-- PASSO 1 — consulta -->
  {#if data.passo === 1}
    <div class="card p-6 flex flex-col gap-4">
      <div class="text-sm font-bold text-calper-dark">Situação da unidade (somente consulta)</div>
      <div class="flex flex-wrap gap-2 text-xs font-bold">
        <span class="px-2.5 py-1 rounded-full {u.statusQuitacao === 'quitada' ? ok : alerta}">
          Pagamento: {u.statusQuitacao === 'quitada' ? 'quitada' : u.statusQuitacao === 'a_vencer' ? 'a vencer' : 'não informado'}
        </span>
        <span class="px-2.5 py-1 rounded-full {u.vistoriaAprovada ? ok : alerta}">
          Vistoria: {u.vistoriaAprovada ? 'aprovada' : 'pendente'}
        </span>
        <span class="px-2.5 py-1 rounded-full {u.escrituraRegistrada ? ok : alerta}">
          Escritura: {u.escrituraRegistrada ? 'registrada' : 'não registrada'}
        </span>
        <span class="px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
          {u.quartos ? `${u.quartos} quartos` : 'Tipologia não informada'}
        </span>
      </div>
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
              {procuracaoVale ? 'Substituir procuração (opcional)' : 'Procuração (JPG, PNG ou PDF, até 4 MB) — obrigatória'}
            </label>
            <input
              id="procuracao"
              name="procuracao"
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              class="input"
              onchange={(e) => (arquivo = e.currentTarget.files?.[0] ?? null)}
            />
            {#if faltaProcuracao}
              <div class="mt-2.5">
                <AvisoSutil>{a.temProcuracao ? 'Envie a procuração da pessoa que está retirando as chaves para continuar.' : 'Quem retira não é comprador desta unidade: envie a procuração para continuar.'}</AvisoSutil>
              </div>
            {/if}
          </div>
        </div>
      {/if}

      <div>
        <label for="email" class="block text-xs font-semibold text-gray-500 mb-1">
          E-mail de quem retira (usado na assinatura)
        </label>
        <input id="email" name="email" type="email" class="input !py-2 text-sm" value={a.retiranteEmail ?? a.email ?? ''} required />
      </div>

      <div class="flex gap-2">
        <a href={href(1)} class="btn-outline text-center flex-1">Voltar</a>
        <div class="flex-1"><SubmitButton loading={enviando}>Confirmar e continuar</SubmitButton></div>
      </div>
    </form>

    <!-- lista de presença -->
    <div class="card p-6 mt-5 flex flex-col gap-3">
      <div class="text-sm font-bold text-calper-dark">Lista de presença</div>
      {#each data.presencas as p (p.id)}
        <div class="flex items-center justify-between gap-3 text-sm border border-gray-100 rounded-xl p-3">
          <div>
            <div class="text-calper-dark font-semibold">{p.nome}</div>
            <div class="text-xs text-gray-500">{p.vinculoRotulo} · {formatarHora(p.createdAt)}</div>
          </div>
          {#if p.vinculo === 'acompanhante'}
            <form method="POST" action="?/removerPresente" use:enhance>
              <input type="hidden" name="id" value={p.id} />
              <button type="submit" class="text-xs font-semibold text-gray-400 hover:text-calper-red">remover</button>
            </form>
          {/if}
        </div>
      {:else}
        <p class="text-sm text-gray-400">Ninguém registrado ainda. Quem retira as chaves entra na lista ao confirmar.</p>
      {/each}

      <form method="POST" action="?/adicionarPresente" use:enhance={() => async ({ update }) => update()} class="flex gap-2">
        <input name="nome" class="input !py-2 text-sm" placeholder="Outra pessoa presente (acompanhante)" required />
        <button type="submit" class="btn-outline !py-2 text-sm shrink-0">Adicionar</button>
      </form>
    </div>

    <!-- PASSO 3 — termo -->
  {:else if data.passo === 3}
    {#if data.documentos.termo === 'assinado'}
      <div class="card p-6 flex flex-col gap-3">
        <div class="text-sm font-bold text-green-700">Termo assinado.</div>
        <a href={href(4)} class="btn-primary text-center">Ir para o checklist</a>
      </div>
    {:else}
      <form method="POST" action="?/enviar" use:enhance={aoEnviar} class="card p-6 flex flex-col gap-3">
        <input type="hidden" name="tipo" value="termo" />
        <div class="text-sm text-gray-600">
          Assina: <strong>{data.signatario.nome ?? '—'}</strong> ({data.signatario.email ?? 'sem e-mail'})
          {#if data.documentos.termo === 'pendente'}
            <span class="ml-2 text-xs font-bold px-2 py-0.5 rounded-full {alerta}">assinatura pendente</span>
          {/if}
        </div>
        <textarea name="texto" rows="26" class="input text-sm font-mono" required>{data.texto}</textarea>
        <p class="text-xs text-gray-400">
          Revise e corrija o texto. Variáveis como {'{{numeroCertidao}}'} precisam ser preenchidas antes do envio.
        </p>
        <SubmitButton loading={enviando}>Enviar para assinatura</SubmitButton>
        <a href={href(2)} class="text-center text-sm text-gray-500">Voltar</a>
      </form>
    {/if}

    <!-- PASSO 4 — checklist -->
  {:else if data.passo === 4}
    {#if data.documentos.checklist === 'assinado'}
      <div class="card p-6 flex flex-col gap-3">
        <div class="text-sm font-bold text-green-700">Checklist assinado.</div>
        <a href={href(5)} class="btn-primary text-center">Concluir</a>
      </div>
    {:else}
      <form method="POST" action="?/enviar" use:enhance={aoEnviar} class="card p-6 flex flex-col gap-4">
        <input type="hidden" name="tipo" value="checklist" />
        <input type="hidden" name="cabecalho" value={data.checklist.cabecalho} />
        <input type="hidden" name="rodape" value={data.checklist.rodape} />

        <div class="text-sm text-gray-600">
          Assina: <strong>{data.signatario.nome ?? '—'}</strong> ({data.signatario.email ?? 'sem e-mail'})
          {#if data.documentos.checklist === 'pendente'}
            <span class="ml-2 text-xs font-bold px-2 py-0.5 rounded-full {alerta}">assinatura pendente</span>
          {/if}
        </div>
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

        <SubmitButton loading={enviando}>Enviar para assinatura</SubmitButton>
        <a href={href(3)} class="text-center text-sm text-gray-500">Voltar</a>
      </form>
    {/if}

    <!-- PASSO 5 — concluído + download -->
  {:else}
    <div class="card p-6 flex flex-col gap-3">
      <div class="text-sm font-bold text-calper-dark">Documentos</div>
      {#each [['termo', 'Termo de entrega de chaves', 3], ['checklist', 'Checklist', 4]] as [tipo, rotulo, passo]}
        <div class="flex items-center justify-between border border-gray-100 rounded-xl p-3">
          <div>
            <div class="text-sm font-semibold text-calper-dark">{rotulo}</div>
            <div class="text-xs {data.documentos[tipo] === 'assinado' ? 'text-green-700' : 'text-amber-700'}">
              {data.documentos[tipo] === 'assinado' ? 'Assinado' : data.documentos[tipo] === 'pendente' ? 'Aguardando assinatura' : 'Não enviado'}
            </div>
          </div>
          {#if data.documentos[tipo] === 'assinado'}
            <a
              href="/admin/entrega-chaves/{a.id}/documento/{tipo}"
              class="text-xs font-bold text-white bg-calper-red px-3 py-2 rounded-lg">Baixar PDF</a
            >
          {:else}
            <a href={href(passo)} class="text-xs font-bold text-calper-red">Assinar</a>
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
      {#if a.status === 'realizado'}
        <div class="text-xs font-bold text-green-700 mt-2">Entrega concluída — agendamento marcado como realizado.</div>
      {/if}
    </div>
  {/if}
</div>
