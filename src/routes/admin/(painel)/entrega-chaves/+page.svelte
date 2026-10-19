<script>
  let { data } = $props();
  let busca = $state('');
  let filtrados = $derived(
    data.agendamentos.filter((a) => {
      const q = busca.trim().toLowerCase();
      if (!q) return true;
      return [a.unidade.bloco, a.unidade.numero, a.nome, a.email].some((v) => (v ?? '').toLowerCase().includes(q));
    })
  );

  function formatarDataHora(iso) {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  const corStatus = {
    confirmado: 'bg-blue-50 text-blue-600',
    realizado: 'bg-green-50 text-green-700',
    cancelado: 'bg-gray-100 text-gray-500'
  };
</script>

<svelte:head>
  <title>Entrega de chaves — Calper</title>
</svelte:head>

<div class="p-5 md:p-8 max-w-6xl">
  <div class="flex items-center justify-between gap-3">
    <h1 class="text-xl font-bold text-calper-dark">Entrega de chaves</h1>
    <a href="/admin/presenca" class="text-sm font-bold text-calper-red">Lista de presença →</a>
  </div>
  <p class="text-sm text-gray-500 mt-0.5 mb-6">Murano Residencial — {data.agendamentos.length} agendamento(s)</p>

  {#if data.semMurano}
    <p class="text-sm text-gray-400">Empreendimento Murano não encontrado.</p>
  {:else if data.agendamentos.length === 0}
    <p class="text-sm text-gray-400">Nenhum agendamento ainda.</p>
  {:else}
    <input bind:value={busca} class="input mb-4" placeholder="Buscar por bloco, unidade, nome ou e-mail" />
    <div class="flex flex-col gap-3">
      {#each filtrados as a (a.id)}
        {@const u = a.unidade}
        <div class="card p-4 md:p-5">
          <div class="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <a href="/admin/unidades/{u.id}" class="text-sm font-bold text-calper-dark hover:text-calper-red">
                Bloco {u.bloco} - nº {u.numero}
              </a>
              <div class="text-xs text-gray-500 mt-0.5">{formatarDataHora(a.dataHora)}</div>
            </div>
            <span class="text-xs font-bold px-2 py-0.5 rounded-full {corStatus[a.status] ?? corStatus.cancelado}">
              {a.status}
            </span>
          </div>

          <div class="text-xs text-gray-600 mt-2">
            Agendado por {a.nome ?? '—'} · {a.telefone ?? '—'} · {a.email ?? '—'}
            {#if a.ehProprietario === false}· <strong>não é o proprietário</strong>{a.proprietarioNome ? ` (proprietário: ${a.proprietarioNome})` : ''}{/if}
            {#if a.retiranteNome}· Retira: <strong>{a.retiranteNome}</strong>{#if a.temProcuracao} (procuração anexada){/if}{:else}· retirante ainda não confirmado{/if}
          </div>

          <div class="flex items-center gap-3 mt-3 text-xs font-bold">
            <a href="/admin/entrega-chaves/{a.id}" class="text-white bg-calper-red px-3 py-1.5 rounded-lg">
              {a.documentos.termo === 'assinado' && a.documentos.checklist === 'assinado' ? 'Ver documentos' : 'Iniciar entrega'}
            </a>
            {#each [['termo', 'Termo'], ['checklist', 'Checklist']] as [tipo, rotulo]}
              {#if a.documentos[tipo] === 'assinado'}
                <a href="/admin/entrega-chaves/{a.id}/documento/{tipo}" class="text-calper-red">PDF {rotulo}</a>
              {/if}
            {/each}
          </div>

          <div class="flex flex-wrap gap-1.5 mt-3 text-[11px] font-bold">
            <span
              class="px-2 py-0.5 rounded-full {u.statusQuitacao === 'quitada'
                ? 'bg-green-50 text-green-700'
                : 'bg-amber-50 text-amber-700'}"
            >
              Pagamento: {u.statusQuitacao === 'quitada' ? 'quitada' : u.statusQuitacao === 'a_vencer' ? 'a vencer' : 'não informado'}
            </span>
            <span class="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
              {u.financiado ? `Financiado (grupo ${u.grupoFinanciamento ?? '?'})` : 'Sem financiamento'}
            </span>
            <span
              class="px-2 py-0.5 rounded-full {u.vistoriaAprovada
                ? 'bg-green-50 text-green-700'
                : 'bg-amber-50 text-amber-700'}"
            >
              Vistoria: {u.vistoriaAprovada ? 'aprovada' : 'pendente'}
            </span>
            <span
              class="px-2 py-0.5 rounded-full {u.escrituraRegistrada
                ? 'bg-green-50 text-green-700'
                : 'bg-gray-100 text-gray-600'}"
            >
              Escritura: {u.escrituraRegistrada ? 'registrada' : 'não registrada'}
            </span>
            {#if u.quartos}
              <span class="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{u.quartos} quartos</span>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
