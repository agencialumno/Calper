<script>
  import { formatarCpf } from '$lib/cpf.js';

  let { data } = $props();

  // horário do agendamento: o relógio escolhido é gravado como UTC (ver agenda.js)
  const dataHoraAgendada = (iso) =>
    new Date(iso).toLocaleString('pt-BR', {
      timeZone: 'UTC',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  const quandoAgendou = (iso) =>
    new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  const corStatus = {
    confirmado: 'bg-blue-50 text-blue-600',
    realizado: 'bg-green-50 text-green-700',
    cancelado: 'bg-gray-100 text-gray-500'
  };
</script>

<svelte:head>
  <title>Quem agendou — Calper</title>
</svelte:head>

<div class="p-5 md:p-8 max-w-6xl">
  <a href="/admin/entrega-chaves" class="text-sm text-gray-500 hover:text-calper-dark">← Entrega de chaves</a>
  <h1 class="text-2xl font-extrabold text-calper-dark mt-3">Quem agendou</h1>
  <p class="text-sm text-gray-500 mt-1 mb-5">
    Todas as pessoas que agendaram pelo formulário público — {data.agendamentos.length}
    {data.agendamentos.length === data.total ? '' : `de ${data.total} `}registro(s)
    · <a href={data.exportarHref} class="font-bold text-calper-red">Exportar CSV</a>
  </p>

  <form method="GET" class="card p-4 grid grid-cols-2 md:grid-cols-[1fr_12rem_auto] gap-3 mb-5 items-end">
    <div class="col-span-2 md:col-span-1">
      <label for="q" class="block text-xs font-semibold text-gray-500 mb-1">Buscar (nome, CPF, telefone, e-mail, unidade)</label>
      <input id="q" name="q" value={data.filtros.q} class="input !py-2 text-sm" />
    </div>
    <div>
      <label for="status" class="block text-xs font-semibold text-gray-500 mb-1">Status</label>
      <select id="status" name="status" class="input !py-2 text-sm">
        <option value="">todos</option>
        <option value="confirmado" selected={data.filtros.status === 'confirmado'}>confirmado</option>
        <option value="realizado" selected={data.filtros.status === 'realizado'}>realizado</option>
        <option value="cancelado" selected={data.filtros.status === 'cancelado'}>cancelado</option>
      </select>
    </div>
    <div class="flex items-center gap-3">
      <button type="submit" class="btn-primary !py-2 text-sm">Filtrar</button>
      <a href="/admin/quem-agendou" class="text-xs font-semibold text-gray-500">Limpar</a>
    </div>
  </form>

  <div class="flex flex-col gap-3">
    {#each data.agendamentos as a (a.id)}
      <div class="card p-4 md:p-5">
        <div class="flex items-start justify-between gap-3 flex-wrap">
          <div class="min-w-0">
            <div class="text-base font-bold text-calper-dark">{a.nome ?? '—'}</div>
            <div class="text-xs text-gray-500 mt-0.5">
              CPF {a.cpf ? formatarCpf(a.cpf) : '—'} · {a.telefone ?? '—'} · {a.email ?? '—'}
            </div>
          </div>
          <span class="text-xs font-bold px-2.5 py-1 rounded-full {corStatus[a.status] ?? corStatus.cancelado}">{a.status}</span>
        </div>

        <div class="grid sm:grid-cols-3 gap-x-6 gap-y-2 mt-3 text-sm">
          <div>
            <div class="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Unidade</div>
            <a href="/admin/entrega-chaves/{a.id}" class="font-bold text-calper-red">{a.unidade}</a>
          </div>
          <div>
            <div class="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Agendado para</div>
            <div class="font-semibold text-calper-dark">{dataHoraAgendada(a.dataHora)}</div>
          </div>
          <div>
            <div class="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Proprietário</div>
            {#if a.ehProprietario === false}
              <div class="font-semibold text-calper-dark">
                {a.proprietarioNome ?? 'não informado'}
                <span class="text-xs font-bold text-amber-700">{a.temProcuracao ? '· procuração anexada' : '· sem procuração'}</span>
              </div>
            {:else}
              <div class="font-semibold text-calper-dark">o próprio investidor</div>
            {/if}
          </div>
        </div>
        <div class="text-[11px] text-gray-400 mt-3">Agendou em {quandoAgendou(a.agendadoEm)}</div>
      </div>
    {:else}
      <div class="card p-10 text-center text-sm text-gray-500">Nenhum agendamento encontrado.</div>
    {/each}
  </div>
</div>
