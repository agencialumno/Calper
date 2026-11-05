<script>
  import UnidadeStatus from '$lib/components/UnidadeStatus.svelte';
  import { rotuloDaTentativa } from '$lib/vistoria.js';
  import { autoAtualizar } from '$lib/autoAtualizar.svelte.js';
  let { data } = $props();
  // a página se atualiza sozinha (novo agendamento, cancelamento, mudança de status)
  const auto = autoAtualizar();
  let busca = $state('');
  let filtrados = $derived(
    data.agendamentos.filter((a) => {
      const q = busca.trim().toLowerCase();
      if (!q) return true;
      return [a.unidade.bloco, a.unidade.numero, a.nome, a.email].some((v) => (v ?? '').toLowerCase().includes(q));
    })
  );

  function formatarDataHora(iso) {
    return new Date(iso).toLocaleString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  const corStatus = {
    confirmado: 'bg-blue-50 text-blue-600',
    realizado: 'bg-green-50 text-green-700',
    cancelado: 'bg-gray-100 text-gray-500'
  };
</script>

<svelte:head>
  <title>Vistoria — Calper</title>
</svelte:head>

<div class="p-5 md:p-8 max-w-6xl">
  <div class="flex items-center justify-between gap-3">
    <h1 class="text-xl font-bold text-calper-dark">Vistoria</h1>
    <div class="flex items-center gap-4 text-sm font-bold text-calper-red">
      <a href="/admin/vistoria/exportar" data-testid="exportar-vistorias">Baixar CSV</a>
      <a href="/admin/quem-agendou?servico=vistoria">Quem agendou →</a>
    </div>
  </div>
  <p class="text-sm text-gray-500 mt-0.5 mb-1">Murano Residencial — {data.agendamentos.length} agendamento(s)</p>
  <p class="text-[11px] text-gray-400 mb-3" data-testid="auto-atualizacao">
    Atualiza sozinha a cada 20 s · última atualização {auto.em.toLocaleTimeString('pt-BR')}
  </p>

  {#if data.semMurano}
    <p class="text-sm text-gray-400">Empreendimento Murano não encontrado.</p>
  {:else if data.agendamentos.length === 0}
    <p class="text-sm text-gray-400" data-testid="sem-agendamentos">Sem agendamentos</p>
  {:else}
    <input bind:value={busca} class="input mb-4" placeholder="Buscar por bloco, unidade, nome ou e-mail" />
    <div class="flex flex-col gap-3">
      {#each filtrados as a (a.id)}
        {@const u = a.unidade}
        <div class="card p-4 md:p-5" data-testid="card-vistoria">
          <div class="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <a href="/admin/unidades/{u.id}" class="text-sm font-bold text-calper-dark hover:text-calper-red">
                Bloco {u.bloco} - nº {u.numero}
              </a>
              <div class="text-xs text-gray-500 mt-0.5">{formatarDataHora(a.dataHora)}</div>
            </div>
            <div class="flex items-center gap-1.5">
              {#if a.origem === 'atendimento_direto'}
                <span class="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700" data-testid="selo-direto">Atendimento direto</span>
              {/if}
              <span class="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{rotuloDaTentativa(a.vistoriaNumero)}</span>
              <span class="text-xs font-bold px-2 py-0.5 rounded-full {a.resultado === 'nao_aceita' ? 'bg-red-50 text-red-700' : a.resultado === 'aceita' && a.status === 'realizado' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}" data-testid="resultado-card">{a.resultadoRotulo}</span>
              <span class="text-xs font-bold px-2 py-0.5 rounded-full {corStatus[a.status] ?? corStatus.cancelado}">{a.status}</span>
            </div>
          </div>

          <div class="text-xs text-gray-600 mt-2">
            Agendado por {a.nome ?? '—'} · {a.telefone ?? '—'} · {a.email ?? '—'}
            {#if a.ehProprietario === false}· <strong>não é o proprietário</strong>{a.proprietarioNome ? ` (proprietário: ${a.proprietarioNome})` : ''}{/if}
          </div>

          {#if a.status === 'cancelado'}
            <div class="mt-3 text-xs text-gray-500">Desmarcado{a.motivoCancelamento ? ` — motivo: ${a.motivoCancelamento}` : ''}. <a href="/admin/vistoria/{a.id}" class="font-bold text-calper-red">Ver registro</a></div>
          {:else}
            <div class="flex items-center gap-3 mt-3 text-xs font-bold">
              <a href="/admin/vistoria/{a.id}{a.status === 'realizado' ? '?passo=5' : ''}" class="text-white bg-calper-red px-3 py-1.5 rounded-lg" data-testid="iniciar-atendimento-vistoria">
                {a.status === 'realizado' ? 'Ver atendimento' : 'Iniciar atendimento'}
              </a>
            </div>
          {/if}

          <div class="mt-3">
            <UnidadeStatus unidade={u} podeEditar={data.podeEditar} />
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
