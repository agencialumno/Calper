<script>
  import { enhance } from '$app/forms';
  import SubmitButton from '$lib/components/SubmitButton.svelte';
  import AvisoSutil from '$lib/components/AvisoSutil.svelte';

  let { data, form } = $props();

  let ehProprietario = $state(form?.valores?.ehProprietario ?? '');
  // valores digitados (voltam preenchidos se o servidor devolver um erro)
  let nomeV = $state(form?.valores?.nome ?? '');
  let cpfV = $state(form?.valores?.cpf ?? '');
  let telefoneV = $state(form?.valores?.telefone ?? '');
  let emailV = $state(form?.valores?.email ?? '');
  let proprietarioNomeV = $state(form?.valores?.proprietarioNome ?? '');
  let dataEscolhida = $state(form?.valores?.data ?? '');
  let horarioEscolhido = $state(form?.valores?.horario ?? '');
  const horariosDoDia = $derived(data.agenda.find((d) => d.data === dataEscolhida)?.horarios ?? []);
  // trocar de dia limpa o horário se ele não existir (ou estiver indisponível) no novo dia
  $effect(() => {
    if (!horariosDoDia.some((h) => h.horario === horarioEscolhido && h.restantes > 0)) horarioEscolhido = '';
  });
  let enviando = $state(false);
  let modalEl = $state(null);
  let modalFechado = $state(false);

  // abre o modal assim que o servidor confirma o agendamento
  $effect(() => {
    if (form?.sucesso && modalEl && !modalFechado && !modalEl.open) modalEl.showModal();
  });
  let arquivoProcuracao = $state(null);
  let arquivoIdentidade = $state(null);
  let tentouEnviar = $state(false);
  let erroTipoProcuracao = $state('');
  let erroIdentidade = $state('');

  // documento de identidade: foto (JPG/PNG) ou PDF, até 4 MB
  function aoEscolherIdentidade(e) {
    const arq = e.currentTarget.files?.[0] ?? null;
    erroIdentidade = '';
    if (arq && !/\.(pdf|jpe?g|png)$/i.test(arq.name)) {
      e.currentTarget.value = '';
      arquivoIdentidade = null;
      erroIdentidade = 'O documento de identidade precisa ser uma foto (JPG ou PNG) ou um PDF.';
      return;
    }
    arquivoIdentidade = arq;
  }

  // só documento de texto (PDF/Word): imagem é recusada na hora, antes de enviar
  function aoEscolherProcuracao(e) {
    const arq = e.currentTarget.files?.[0] ?? null;
    erroTipoProcuracao = '';
    if (arq && !/\.(pdf|docx?)$/i.test(arq.name)) {
      e.currentTarget.value = '';
      arquivoProcuracao = null;
      erroTipoProcuracao = 'A procuração precisa ser um documento: PDF, DOC ou DOCX (não aceitamos imagem).';
      return;
    }
    arquivoProcuracao = arq;
  }
  const faltaProcuracao = $derived(ehProprietario === 'nao' && !arquivoProcuracao);
  const faltaIdentidade = $derived(ehProprietario === 'nao' && !arquivoIdentidade);

  function aoSubmeter({ cancel }) {
    tentouEnviar = true;
    if (faltaProcuracao || faltaIdentidade) {
      cancel();
      return;
    }
    enviando = true;
    return async ({ update }) => {
      await update({ reset: false });
      enviando = false;
    };
  }

  function formatarDataBr(iso) {
    return iso.split('-').reverse().join('/');
  }
</script>

<svelte:head>
  <title>Agendar entrega de chaves — Calper</title>
</svelte:head>

<div class="max-w-xl mx-auto p-5 md:p-10">
  <img src="/logo.png" alt="Calper" class="h-14 w-auto mb-6" />
  <h1 class="text-xl md:text-2xl font-bold text-calper-dark mb-1">Agendar entrega de chaves</h1>
  <p class="text-sm text-gray-500 mb-6">Murano Residencial</p>

  {#if form?.sucesso}
    <dialog
      bind:this={modalEl}
      oncancel={(e) => e.preventDefault()}
      class="rounded-2xl p-0 w-[calc(100%-2rem)] max-w-md backdrop:bg-black/50 m-auto"
      aria-labelledby="titulo-confirmacao"
    >
      <div class="p-6 md:p-8">
        <div class="w-12 h-12 rounded-full bg-green-50 text-green-600 flex items-center justify-center mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <path d="M5 12l5 5 9-10" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
        <h2 id="titulo-confirmacao" class="text-xl font-extrabold text-calper-dark mb-1">
          Agendamento realizado com sucesso
        </h2>
        <p class="text-sm text-gray-500 mb-5">Guarde os dados abaixo.</p>

        <dl class="flex flex-col gap-3 text-sm mb-5">
          <div class="flex justify-between gap-4">
            <dt class="text-gray-500">Unidade</dt>
            <dd class="font-bold text-calper-dark text-right">{form.resumo.unidade}</dd>
          </div>
          <div class="flex justify-between gap-4">
            <dt class="text-gray-500">Data</dt>
            <dd class="font-bold text-calper-dark text-right">{formatarDataBr(form.resumo.data)}</dd>
          </div>
          <div class="flex justify-between gap-4">
            <dt class="text-gray-500">Horário</dt>
            <dd class="font-bold text-calper-dark text-right">{form.resumo.horario}</dd>
          </div>
          <div class="flex justify-between gap-4">
            <dt class="text-gray-500">Agendado por</dt>
            <dd class="font-bold text-calper-dark text-right">{form.resumo.nome}</dd>
          </div>
        </dl>

        <p class="text-xs text-gray-500 mb-6">Apresente seu documento com foto à equipe Calper no dia.</p>
        <button
          type="button"
          class="btn-primary w-full"
          onclick={() => {
            modalFechado = true;
            modalEl.close();
          }}
        >
          Entendi
        </button>
      </div>
    </dialog>

    {#if modalFechado}
      <div class="card p-6 md:p-8">
        <div class="text-lg font-bold text-calper-dark mb-2">Agendamento confirmado</div>
        <p class="text-sm text-gray-600">
          {form.resumo.unidade} — {formatarDataBr(form.resumo.data)} às {form.resumo.horario} ({form.resumo.nome}).
        </p>
        <p class="text-xs text-gray-400 mt-3">Apresente seu documento com foto à equipe Calper no dia.</p>
      </div>
    {/if}
  {:else if !data.disponivel}
    <AvisoSutil>Agendamento indisponível no momento.</AvisoSutil>
  {:else}
    <form
      method="POST"
      enctype="multipart/form-data"
      use:enhance={aoSubmeter}
      class="card p-6 md:p-8 flex flex-col gap-5"
    >
      {#if form?.erro}
        <AvisoSutil>{form.erro}</AvisoSutil>
      {/if}

      <div>
        <label for="nome" class="block text-sm font-semibold text-calper-dark mb-1.5">Nome do investidor</label>
        <input id="nome" name="nome" class="input" bind:value={nomeV} required />
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label for="cpf" class="block text-sm font-semibold text-calper-dark mb-1.5">CPF</label>
          <input id="cpf" name="cpf" inputmode="numeric" class="input" bind:value={cpfV} required />
        </div>
        <div>
          <label for="telefone" class="block text-sm font-semibold text-calper-dark mb-1.5">Telefone</label>
          <input
            id="telefone"
            name="telefone"
            type="tel"
            class="input"
            bind:value={telefoneV}
            required
          />
        </div>
      </div>

      <div>
        <label for="email" class="block text-sm font-semibold text-calper-dark mb-1.5">E-mail</label>
        <input id="email" name="email" type="email" class="input" bind:value={emailV} required />
      </div>

      <div>
        <label for="unidadeId" class="block text-sm font-semibold text-calper-dark mb-1.5">Unidade</label>
        <select id="unidadeId" name="unidadeId" class="input" required>
          <option value="">selecione</option>
          {#each data.unidades as u (u.id)}
            <option value={u.id} selected={form?.valores?.unidadeId === u.id}>
              Bloco {u.bloco} - nº {u.numero}
            </option>
          {/each}
        </select>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label for="data" class="block text-sm font-semibold text-calper-dark mb-1.5">Data</label>
          <select id="data" name="data" class="input" bind:value={dataEscolhida} required>
            <option value="">selecione</option>
            {#each data.agenda as d (d.data)}
              <option value={d.data}>{formatarDataBr(d.data)}</option>
            {/each}
          </select>
        </div>
        <div>
          <label for="horario" class="block text-sm font-semibold text-calper-dark mb-1.5">Horário</label>
          <select id="horario" name="horario" class="input" bind:value={horarioEscolhido} required disabled={!dataEscolhida}>
            <option value="">{dataEscolhida ? 'selecione' : 'escolha a data primeiro'}</option>
            {#each horariosDoDia as h (h.horario)}
              <option value={h.horario} disabled={h.restantes === 0}>
                {h.horario}{h.restantes === 0 ? ' (indisponível)' : ''}
              </option>
            {/each}
          </select>
        </div>
      </div>
      {#if data.agenda.length === 0}
        <AvisoSutil>No momento não há datas abertas para agendamento. Tente novamente mais tarde.</AvisoSutil>
      {/if}

      <fieldset>
        <legend class="block text-sm font-semibold text-calper-dark mb-1.5">
          Eu sou o proprietário da unidade
        </legend>
        <div class="flex gap-5 text-sm text-calper-dark">
          <label class="flex items-center gap-2">
            <input type="radio" name="ehProprietario" value="sim" bind:group={ehProprietario} required /> Sim
          </label>
          <label class="flex items-center gap-2">
            <input type="radio" name="ehProprietario" value="nao" bind:group={ehProprietario} /> Não
          </label>
        </div>
      </fieldset>

      {#if ehProprietario === 'nao'}
        <div class="rounded-xl border border-gray-200 p-4 flex flex-col gap-3 -mt-1">
          <div>
            <label for="proprietarioNome" class="block text-sm font-semibold text-calper-dark mb-1.5">
              Nome do proprietário <span class="text-calper-red">*</span>
            </label>
            <input
              id="proprietarioNome"
              name="proprietarioNome"
              class="input"
              bind:value={proprietarioNomeV}
              placeholder="Nome de quem é o proprietário da unidade"
              required
            />
          </div>
          <label for="procuracao" class="block text-sm font-semibold text-calper-dark">
            Procuração (PDF, DOC ou DOCX, até 4 MB) <span class="text-calper-red">*</span>
          </label>
          <p class="text-xs text-gray-500">
            Anexe a procuração — a equipe Calper vai conferir no dossiê da unidade antes do atendimento.
          </p>
          <input
            id="procuracao"
            name="procuracao"
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            class="input"
            onchange={aoEscolherProcuracao}
          />
          {#if erroTipoProcuracao}
            <AvisoSutil>{erroTipoProcuracao}</AvisoSutil>
          {/if}
          {#if tentouEnviar && faltaProcuracao}
            <AvisoSutil>Anexe a procuração para confirmar o agendamento.</AvisoSutil>
          {/if}

          <label for="identidade" class="block text-sm font-semibold text-calper-dark mt-1">
            Documento de identidade de quem vai assinar/comparecer (foto ou PDF, até 4 MB) <span class="text-calper-red">*</span>
          </label>
          <p class="text-xs text-gray-500">RG, CNH ou outro documento oficial com foto da pessoa que vai ao atendimento.</p>
          <input
            id="identidade"
            name="identidade"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            class="input"
            onchange={aoEscolherIdentidade}
          />
          {#if erroIdentidade}
            <AvisoSutil>{erroIdentidade}</AvisoSutil>
          {/if}
          {#if tentouEnviar && faltaIdentidade}
            <AvisoSutil>Anexe o documento de identidade para confirmar o agendamento.</AvisoSutil>
          {/if}
        </div>
      {/if}

      <SubmitButton loading={enviando}>Confirmar agendamento</SubmitButton>
    </form>
  {/if}
</div>
