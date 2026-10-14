<script>
  import { enhance } from '$app/forms';
  import SubmitButton from '$lib/components/SubmitButton.svelte';
  import AvisoSutil from '$lib/components/AvisoSutil.svelte';

  let { data, form } = $props();

  let u = $derived(data.unidade);
  let a = $derived(data.agendamento);
  let enviando = $state(false);
  let quemEscolhido = $state('');
  $effect(() => {
    quemEscolhido = data.quem;
  });

  const passos = ['Unidade', 'Quem retira', 'Termo', 'Checklist', 'Concluído'];

  const href = (passo, quem = data.quem) =>
    `?passo=${passo}${quem ? `&quem=${encodeURIComponent(quem)}` : ''}`;

  function aoEnviar() {
    enviando = true;
    return async ({ update }) => {
      await update({ reset: false });
      enviando = false;
    };
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

  const ok = 'bg-green-50 text-green-700';
  const alerta = 'bg-amber-50 text-amber-700';
</script>

<svelte:head>
  <title>Entrega de chaves — Bloco {u.bloco} nº {u.numero}</title>
</svelte:head>

<div class="p-5 md:p-8 max-w-3xl">
  <a href="/admin/entrega-chaves" class="text-sm text-gray-500 hover:text-calper-dark">← Entrega de chaves</a>
  <h1 class="text-xl font-bold text-calper-dark mt-3 mb-1">Bloco {u.bloco} - nº {u.numero}</h1>
  <p class="text-sm text-gray-500 mb-5">Agendado para {formatarDataHora(a.dataHora)}</p>

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
        <span class="px-2.5 py-1 rounded-full {u.statusPagamento === 'quitado' ? ok : alerta}">
          Pagamento: {u.statusPagamento}
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

    <!-- PASSO 2 — quem retira -->
  {:else if data.passo === 2}
    <form method="GET" class="card p-6 flex flex-col gap-4">
      <input type="hidden" name="passo" value="3" />
      <div class="text-sm font-bold text-calper-dark">Quem está retirando as chaves?</div>

      {#each data.titulares as t (t.investidorId)}
        <label class="flex items-center gap-2.5 text-sm text-calper-dark border border-gray-100 rounded-xl p-3">
          <input type="radio" name="quem" value={t.investidorId} bind:group={quemEscolhido} required />
          <span>{t.nome} <span class="text-gray-400">· CPF {t.cpf}</span></span>
        </label>
      {/each}

      {#if a.ehProprietario === false}
        <label class="flex items-start gap-2.5 text-sm text-calper-dark border border-gray-100 rounded-xl p-3">
          <input type="radio" name="quem" value="procurador" bind:group={quemEscolhido} class="mt-1" required />
          <span>
            Procurador: <strong>{a.nome}</strong>
            <span class="text-gray-400">· CPF {a.cpf}</span>
          </span>
        </label>

        <div class="border border-gray-200 rounded-xl p-3">
          <div class="text-xs font-bold text-gray-500 mb-2">Procuração enviada no agendamento</div>
          {#if a.temProcuracao}
            {#if a.procuracaoTipo?.startsWith('image/')}
              <img src="/admin/entrega-chaves/{a.id}/procuracao" alt="Procuração" class="max-h-96 rounded-lg" />
            {:else}
              <iframe
                src="/admin/entrega-chaves/{a.id}/procuracao"
                title="Procuração"
                class="w-full h-96 rounded-lg border border-gray-100"
              ></iframe>
            {/if}
            <a
              href="/admin/entrega-chaves/{a.id}/procuracao"
              target="_blank"
              class="text-xs font-semibold text-calper-red mt-2 inline-block">Abrir em nova aba</a
            >
          {:else}
            <p class="text-sm text-calper-red">Procuração não encontrada.</p>
          {/if}
        </div>
      {:else}
        <p class="text-xs text-gray-400">Agendamento feito pelo proprietário: {a.nome} · {a.email}</p>
      {/if}

      <div class="flex gap-2">
        <a href={href(1)} class="btn-outline text-center flex-1">Voltar</a>
        <button type="submit" class="btn-primary flex-1">Continuar</button>
      </div>
    </form>

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
        <input type="hidden" name="quem" value={data.quem} />
        <div class="text-sm text-gray-600">
          Assina: <strong>{data.signatario.nome ?? '—'}</strong> ({data.signatario.email ?? 'sem e-mail'})
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
        <input type="hidden" name="quem" value={data.quem} />
        <input type="hidden" name="cabecalho" value={data.checklist.cabecalho} />
        <input type="hidden" name="rodape" value={data.checklist.rodape} />

        <div class="text-sm text-gray-600">
          Assina: <strong>{data.signatario.nome ?? '—'}</strong> ({data.signatario.email ?? 'sem e-mail'})
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
              {data.documentos[tipo] === 'assinado' ? 'Assinado' : 'Pendente'}
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
    </div>
  {/if}
</div>
