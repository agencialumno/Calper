<script>
  import { enhance } from '$app/forms';
  import SubmitButton from '$lib/components/SubmitButton.svelte';

  let { data } = $props();
  let u = $derived(data.unidade);
  let adicionando = $state(false);
  let financiado = $state(false);
  let salvandoFin = $state(false);
  let salvandoTipologia = $state(false);
  $effect(() => {
    financiado = data.unidade.financiado;
  });

  function aoSubmeterFin() {
    salvandoFin = true;
    return async ({ update }) => {
      await update({ reset: false });
      salvandoFin = false;
    };
  }

  function aoSubmeterTipologia() {
    salvandoTipologia = true;
    return async ({ update }) => {
      await update({ reset: false });
      salvandoTipologia = false;
    };
  }

  let editandoEmailDe = $state(null); // investidorId em edição, ou null
  let salvandoEmail = $state(false);

  function aoSubmeterApontamento() {
    adicionando = true;
    return async ({ update }) => {
      await update();
      adicionando = false;
    };
  }

  function aoSubmeterEmail() {
    salvandoEmail = true;
    return async ({ update }) => {
      await update();
      salvandoEmail = false;
      editandoEmailDe = null;
    };
  }

  const vinculoRotulo = {
    comprador_principal: 'comprador principal',
    comprador: 'comprador',
    procurador: 'procurador',
    acompanhante: 'acompanhante'
  };

  const statusLabel = {
    regularizado: 'Regularizado',
    troca_titularidade: 'Troca de titularidade',
    distrato: 'Distrato'
  };

  const tipoCor = {
    cadastro: 'bg-gray-100 text-gray-500',
    vistoria: 'bg-blue-50 text-blue-600',
    avaliacao: 'bg-amber-50 text-amber-700',
    apontamento: 'bg-red-50 text-calper-red',
    evento_realizado: 'bg-green-50 text-green-700',
    documento: 'bg-gray-100 text-gray-500',
    outro: 'bg-gray-100 text-gray-500'
  };

  function formatarData(iso) {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  }
</script>

<svelte:head>
  <title>Unidade {u.numero} — Calper</title>
</svelte:head>

<div class="p-8 max-w-5xl">
  <a href="/admin/unidades" class="text-sm text-gray-500 hover:text-calper-dark">← Unidades</a>

  <div class="flex items-center justify-between flex-wrap gap-4 mt-4 mb-7">
    <div>
      <h1 class="text-xl font-bold text-calper-dark">Unidade {u.numero} — Bloco {u.bloco}</h1>
      <p class="text-sm text-gray-500 mt-0.5">{u.empreendimento}</p>
    </div>
    <form method="POST" action="?/atualizarStatus" use:enhance>
      <select
        name="status"
        class="input !py-2 text-sm"
        onchange={(e) => e.currentTarget.form.requestSubmit()}
      >
        {#each Object.entries(statusLabel) as [valor, rotulo]}
          <option value={valor} selected={valor === u.status}>{rotulo}</option>
        {/each}
      </select>
    </form>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-[1.1fr_1.4fr] gap-5">
    <!-- tipologia + status financeiro/jurídico -->
    <div class="card p-6 flex flex-col gap-5">
      <form
        method="POST"
        action="?/atualizarTipologia"
        use:enhance={aoSubmeterTipologia}
        class="flex items-end gap-2"
      >
        <div class="flex-1">
          <label for="quartos" class="block text-sm font-bold text-calper-dark mb-1.5">Tipologia (quartos)</label>
          <input
            id="quartos"
            name="quartos"
            type="number"
            min="1"
            max="10"
            value={u.quartos ?? ''}
            class="input !py-2 text-sm"
            placeholder="ex: 2 ou 3"
          />
        </div>
        <div class="w-28 shrink-0">
          <SubmitButton loading={salvandoTipologia} variant="outline" class="!py-2.5 text-sm">Salvar</SubmitButton>
        </div>
      </form>

      <div class="h-px bg-gray-100"></div>

      <form
        method="POST"
        action="?/atualizarFinanceiroJuridico"
        use:enhance={aoSubmeterFin}
        class="flex flex-col gap-3.5"
      >
        <div class="text-sm font-bold text-calper-dark">Status financeiro e jurídico</div>

        <div>
          <label for="statusQuitacao" class="block text-xs font-semibold text-gray-500 mb-1">Pagamento</label>
          <select id="statusQuitacao" name="statusQuitacao" class="input !py-2 text-sm">
            <option value="" selected={!u.statusQuitacao}>Não informado</option>
            <option value="a_vencer" selected={u.statusQuitacao === 'a_vencer'}>A vencer</option>
            <option value="quitada" selected={u.statusQuitacao === 'quitada'}>Quitada</option>
          </select>
        </div>

        <label class="flex items-center gap-2 text-sm text-calper-dark">
          <input type="checkbox" name="financiado" bind:checked={financiado} />
          Financiado
        </label>

        {#if financiado}
          <div>
            <label for="grupoFinanciamento" class="block text-xs font-semibold text-gray-500 mb-1">
              Grupo de financiamento
            </label>
            <select id="grupoFinanciamento" name="grupoFinanciamento" class="input !py-2 text-sm" required>
              <option value="">selecione</option>
              <option value="A" selected={u.grupoFinanciamento === 'A'}>Grupo A</option>
              <option value="B" selected={u.grupoFinanciamento === 'B'}>Grupo B</option>
            </select>
          </div>
        {/if}

        <label class="flex items-center gap-2 text-sm text-calper-dark">
          <input type="checkbox" name="vistoriaAprovada" checked={u.vistoriaAprovada} />
          Vistoria aprovada
        </label>
        <label class="flex items-center gap-2 text-sm text-calper-dark">
          <input type="checkbox" name="escrituraRegistrada" checked={u.escrituraRegistrada} />
          Escritura registrada
        </label>

        <SubmitButton loading={salvandoFin} variant="outline" class="!py-2.5 text-sm">Salvar status</SubmitButton>
      </form>
    </div>

    <!-- compradores (base Murano) + documentos de entrega -->
    {#if u.compradores.length > 0 || u.tipologia}
      <div class="card p-6 flex flex-col gap-4">
        <div class="text-sm font-bold text-calper-dark">Compradores e entrega de chaves</div>
        <div class="flex flex-wrap gap-2 text-xs font-bold">
          {#if u.tipologia}<span class="px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">{u.tipologia}</span>{/if}
          {#if u.grupo}<span class="px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">Grupo {u.grupo}</span>{/if}
          {#if u.statusQuitacao}
            <span
              class="px-2.5 py-1 rounded-full {u.statusQuitacao === 'quitada'
                ? 'bg-green-50 text-green-700'
                : 'bg-amber-50 text-amber-700'}"
            >
              {u.statusQuitacao === 'quitada' ? 'Quitada' : 'A vencer'}
            </span>
          {/if}
        </div>
        {#each u.compradores as c}
          <div class="text-sm text-calper-dark">
            {c.nome}
            {#if c.principal}<span class="text-[11px] font-bold text-calper-red ml-1">principal</span>{/if}
          </div>
        {:else}
          <p class="text-sm text-gray-400">Sem comprador cadastrado.</p>
        {/each}
        <div class="flex gap-4 text-sm font-bold text-calper-red">
          <a href="/admin/unidades/{u.id}/termo-entrega">Termo de entrega</a>
          <a href="/admin/unidades/{u.id}/checklist">Checklist</a>
        </div>
      </div>
    {:else}
      <div class="card p-6 flex gap-4 text-sm font-bold text-calper-red items-start">
        <a href="/admin/unidades/{u.id}/termo-entrega">Termo de entrega</a>
        <a href="/admin/unidades/{u.id}/checklist">Checklist</a>
      </div>
    {/if}

    <!-- investidores -->
    <div class="card p-6">
      <div class="text-sm font-bold text-calper-dark mb-4">Investidores vinculados</div>
      <div class="flex flex-col gap-3">
        {#each u.investidores as inv (inv.investidorId)}
          <div class="border border-gray-100 rounded-xl p-3.5">
            <div class="font-bold text-sm text-calper-dark">{inv.nome}</div>

            {#if editandoEmailDe === inv.investidorId}
              <form
                method="POST"
                action="?/atualizarEmail"
                use:enhance={aoSubmeterEmail}
                class="flex items-center gap-1.5 mt-1.5"
              >
                <input type="hidden" name="investidorId" value={inv.investidorId} />
                <input
                  type="email"
                  name="email"
                  value={inv.email}
                  required
                  class="input !py-1.5 text-xs flex-1"
                  autofocus
                />
                <button
                  type="submit"
                  disabled={salvandoEmail}
                  class="text-[11px] font-bold text-white bg-calper-red px-2.5 py-1.5 rounded-lg shrink-0 disabled:opacity-50"
                >
                  Salvar
                </button>
                <button
                  type="button"
                  onclick={() => (editandoEmailDe = null)}
                  class="text-[11px] font-semibold text-gray-400 px-1.5 py-1.5 shrink-0"
                >
                  Cancelar
                </button>
              </form>
            {:else}
              <button
                type="button"
                onclick={() => (editandoEmailDe = inv.investidorId)}
                class="w-full flex items-center justify-between gap-2 text-xs text-gray-600 mt-1.5 bg-gray-50 hover:bg-red-50 border border-gray-100 hover:border-red-100 rounded-lg px-2.5 py-2 transition-colors group"
              >
                <span class="truncate">{inv.email}</span>
                <span
                  class="flex items-center gap-1 text-[11px] font-bold text-calper-red shrink-0"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path
                      d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                  editar
                </span>
              </button>
            {/if}

            <div class="text-xs text-gray-400 mt-0.5">CPF: {inv.cpf}</div>
            {#if inv.primeiroAcesso}
              <span class="inline-block mt-1.5 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                aguardando primeiro acesso
              </span>
            {/if}
          </div>
        {/each}
      </div>
    </div>

    <!-- agendamentos -->
    <div class="card p-6">
      <div class="text-sm font-bold text-calper-dark mb-4">Agendamentos</div>
      {#if u.agendamentos.length === 0}
        <p class="text-sm text-gray-400">Nenhum agendamento ainda.</p>
      {:else}
        <div class="flex flex-col gap-2.5">
          {#each u.agendamentos as a (a.id)}
            <div class="border border-gray-100 rounded-xl p-3 flex items-center justify-between">
              <div>
                <div class="text-sm font-bold text-calper-dark">{a.tipoNome}</div>
                <div class="text-xs text-gray-500 mt-0.5">{formatarData(a.dataHora)}</div>
                {#if a.ehEntregaChaves}
                  <div class="text-xs text-gray-600 mt-1.5">
                    <span class="font-bold text-gray-500">Agendado por:</span> {a.agendadoPor ?? '—'}
                    {#if a.retirante}
                      · <span class="font-bold text-gray-500">Retirou:</span> {a.retirante.nome}
                      {#if a.retirante.vinculo}({vinculoRotulo[a.retirante.vinculo] ?? a.retirante.vinculo}){/if}
                    {/if}
                  </div>
                  <div class="flex flex-wrap gap-1.5 mt-2 text-[11px] font-bold">
                    {#each [['termo', 'Termo'], ['checklist', 'Checklist']] as [tipo, rotulo]}
                      {@const doc = a.documentos.find((d) => d.tipo === tipo)}
                      <span
                        class="px-2 py-0.5 rounded-full {doc?.status === 'assinado'
                          ? 'bg-green-50 text-green-700'
                          : doc?.status === 'pendente'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-gray-100 text-gray-500'}"
                      >
                        {rotulo}: {doc?.status === 'assinado' ? 'assinado' : doc?.status === 'pendente' ? 'pendente' : 'não enviado'}
                      </span>
                      {#if doc?.status === 'assinado'}
                        <a href="/admin/entrega-chaves/{a.id}/documento/{tipo}" class="text-calper-red">baixar</a>
                      {/if}
                    {/each}
                  </div>
                  {#if a.presencas.length > 0}
                    <div class="mt-2 text-xs text-gray-600">
                      <span class="font-bold text-gray-500">Presentes:</span>
                      {#each a.presencas as p, i}
                        {p.nome} ({vinculoRotulo[p.vinculo] ?? p.vinculo}, {new Date(p.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}){i < a.presencas.length - 1 ? '; ' : ''}
                      {/each}
                    </div>
                  {/if}
                  <a href="/admin/entrega-chaves/{a.id}" class="text-xs font-bold text-calper-red mt-2 inline-block">Abrir fluxo de entrega →</a>
                {/if}
              </div>
              <span class="text-xs font-bold px-2 py-0.5 rounded-full {tipoCor[a.status] ?? tipoCor.outro}">
                {a.status}
              </span>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- histórico -->
    <div class="card p-6">
      <div class="text-sm font-bold text-calper-dark mb-4">Histórico</div>

      <form method="POST" action="?/adicionarApontamento" use:enhance={aoSubmeterApontamento} class="flex gap-2 mb-5">
        <input type="hidden" name="tipo" value="apontamento" />
        <input name="descricao" class="input text-sm" placeholder="Adicionar apontamento..." required />
        <div class="w-32 shrink-0">
          <SubmitButton loading={adicionando} variant="outline" class="!py-2.5 text-sm whitespace-nowrap">
            Adicionar
          </SubmitButton>
        </div>
      </form>

      <div class="flex flex-col">
        {#each u.historico as h (h.id)}
          <div class="flex gap-3 py-3 border-t border-gray-100 first:border-t-0">
            <span class="text-[11px] font-bold px-2 py-0.5 rounded-full h-fit shrink-0 {tipoCor[h.tipo] ?? tipoCor.outro}">
              {h.tipo.replace('_', ' ')}
            </span>
            <div class="min-w-0">
              <div class="text-sm text-calper-dark">{h.descricao}</div>
              <div class="text-xs text-gray-400 mt-0.5">{formatarData(h.createdAt)}</div>
            </div>
          </div>
        {:else}
          <p class="text-sm text-gray-400 py-4">Nenhum evento registrado ainda.</p>
        {/each}
      </div>
    </div>
  </div>
</div>