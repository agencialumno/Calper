<script>
  import { enhance } from '$app/forms';

  let { data, form } = $props();

  let usarNovoEmpreendimento = $state(data.empreendimentos.length === 0);
  let investidores = $state([{ nome: '', cpf: '', email: '' }]);

  function adicionarInvestidor() {
    if (investidores.length < 3) investidores.push({ nome: '', cpf: '', email: '' });
  }
  function removerInvestidor(i) {
    investidores.splice(i, 1);
  }
</script>

<svelte:head>
  <title>Nova unidade — Calper</title>
</svelte:head>

<div class="p-8 max-w-2xl">
  <a href="/admin/unidades" class="text-sm text-gray-500 hover:text-calper-dark">← Unidades</a>

  {#if form?.sucesso}
    <div class="card p-7 mt-4">
      <h1 class="text-lg font-bold text-calper-dark mb-1">Unidade cadastrada</h1>
      <p class="text-sm text-gray-500 mb-6">
        Senha temporária gerada para o(s) investidor(es) novo(s) — anote agora, ela não será
        mostrada de novo. No primeiro acesso, o próprio investidor define uma senha definitiva.
      </p>
      <div class="flex flex-col gap-2.5 mb-6">
        {#each form.credenciais as c}
          <div class="border border-gray-200 rounded-xl px-4 py-3 text-sm">
            <div class="font-bold text-calper-dark">{c.nome}</div>
            <div class="text-gray-500">{c.email}</div>
            <div class="mt-1.5 font-mono text-calper-red font-bold">{c.senhaTemporaria}</div>
          </div>
        {/each}
      </div>
      <a href={`/admin/unidades/${form.unidadeId}`} class="btn-primary inline-block text-sm">
        Ver dossiê da unidade
      </a>
    </div>
  {:else}
    <h1 class="text-xl font-bold text-calper-dark mt-4 mb-6">Nova unidade</h1>

    <form method="POST" use:enhance class="card p-7 flex flex-col gap-5">
      {#if form?.erro}
        <div class="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-3.5 py-3">
          {form.erro}
        </div>
      {/if}

      <div>
        <div class="block text-sm font-semibold text-calper-dark mb-1.5">Empreendimento</div>
        {#if !usarNovoEmpreendimento}
          <select name="empreendimentoId" class="input">
            {#each data.empreendimentos as emp}
              <option value={emp.id}>{emp.nome}</option>
            {/each}
          </select>
          <button
            type="button"
            class="text-xs text-calper-red font-semibold mt-1.5"
            onclick={() => (usarNovoEmpreendimento = true)}
          >
            + cadastrar novo empreendimento
          </button>
        {:else}
          <input name="novoEmpreendimentoNome" class="input" placeholder="Nome do empreendimento" />
          {#if data.empreendimentos.length > 0}
            <button
              type="button"
              class="text-xs text-gray-500 font-semibold mt-1.5"
              onclick={() => (usarNovoEmpreendimento = false)}
            >
              usar um empreendimento existente
            </button>
          {/if}
        {/if}
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label for="bloco" class="block text-sm font-semibold text-calper-dark mb-1.5">Bloco</label>
          <input id="bloco" name="bloco" class="input" placeholder="B" required />
        </div>
        <div>
          <label for="numero" class="block text-sm font-semibold text-calper-dark mb-1.5">Número</label>
          <input id="numero" name="numero" class="input" placeholder="1204" required />
        </div>
      </div>

      <div>
        <div class="flex items-center justify-between mb-2">
          <div class="text-sm font-semibold text-calper-dark">Investidores (até 3)</div>
          {#if investidores.length < 3}
            <button type="button" class="text-xs text-calper-red font-semibold" onclick={adicionarInvestidor}>
              + adicionar
            </button>
          {/if}
        </div>

        <div class="flex flex-col gap-3">
          {#each investidores as inv, i (i)}
            <div class="border border-gray-200 rounded-xl p-3.5 flex flex-col gap-2.5">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-gray-400">INVESTIDOR {i + 1}</span>
                {#if investidores.length > 1}
                  <button
                    type="button"
                    class="text-xs text-gray-400 hover:text-calper-red"
                    onclick={() => removerInvestidor(i)}>remover</button
                  >
                {/if}
              </div>
              <input
                name="investidorNome"
                bind:value={inv.nome}
                class="input"
                placeholder="Nome completo"
                required
              />
              <div class="grid grid-cols-2 gap-2.5">
                <input
                  name="investidorCpf"
                  bind:value={inv.cpf}
                  class="input"
                  placeholder="CPF"
                  required
                />
                <input
                  name="investidorEmail"
                  bind:value={inv.email}
                  class="input"
                  type="email"
                  placeholder="E-mail"
                  required
                />
              </div>
            </div>
          {/each}
        </div>
      </div>

      <button type="submit" class="btn-primary mt-1">Cadastrar unidade</button>
    </form>
  {/if}
</div>
