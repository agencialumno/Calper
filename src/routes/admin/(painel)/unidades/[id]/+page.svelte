<script>
  import { enhance } from '$app/forms';
  import SubmitButton from '$lib/components/SubmitButton.svelte';

  let { data } = $props();
  const u = data.unidade;
  let adicionando = $state(false);
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
                class="flex items-center gap-1.5 mt-1"
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
                class="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5 hover:text-calper-red group"
              >
                {inv.email}
                <span class="text-[10px] font-bold text-gray-300 group-hover:text-calper-red">editar</span>
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