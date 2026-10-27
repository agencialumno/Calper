<script>
  import { tick } from 'svelte';
  import { applyAction, enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { MOTIVO_MAXIMO, rotuloDataHora } from '$lib/gestaoAgendamento.js';

  // Alterar (trocar a unidade), Remarcar e Desmarcar um agendamento. Só aparece para admin e supervisor (o servidor
  // recusa as chamadas de quem não pode). Os botões bloqueados mostram o motivo. Nada é apagado: desmarcar só cancela.
  //  ag: { id, nome, unidade, dataHora, status, bloqueios: { alterar, remarcar, desmarcar }, trocouUnidade,
  //        temIdentidadeEnviada, temProcuracaoEnviada }
  let { ag, unidades = [], agenda = [], class: classe = '' } = $props();

  let dialogo = $state(null); // 'alterar' | 'remarcar' | 'desmarcar'
  let enviando = $state(false);
  let erro = $state('');
  let aviso = $state('');
  let dataEscolhida = $state('');
  let motivo = $state('');
  let elemento = $state({});

  const horariosDoDia = $derived(agenda.find((d) => d.data === dataEscolhida)?.horarios.filter((h) => h.restantes > 0) ?? []);
  const rotuloData = (iso) => iso.split('-').reverse().join('/');
  const bloqueadas = $derived(
    [...new Set(['alterar', 'remarcar', 'desmarcar'].map((a) => ag.bloqueios[a]).filter(Boolean))]
  );

  async function abrir(qual) {
    erro = '';
    aviso = '';
    dialogo = qual;
    dataEscolhida = '';
    motivo = '';
    await tick(); // espera o <dialog> existir no DOM
    elemento[qual]?.showModal();
  }
  function fechar() {
    elemento[dialogo]?.close();
    dialogo = null;
  }

  function aoEnviar() {
    enviando = true;
    erro = '';
    return async ({ result }) => {
      enviando = false;
      if (result.type === 'failure') {
        erro = result.data?.erro ?? 'Não foi possível concluir.';
      } else if (result.type === 'success') {
        aviso = result.data?.sucesso ?? '';
        fechar();
        await invalidateAll(); // a lista e as vagas se atualizam na hora
      } else {
        await applyAction(result);
      }
    };
  }
</script>

<div class="flex flex-col gap-2 {classe}" data-testid="acoes-agendamento">
  {#if ag.status !== 'cancelado' && ag.status !== 'realizado'}
    <div class="flex flex-wrap items-center gap-2">
      <button type="button" class="text-xs font-bold text-calper-dark border border-gray-300 px-3 py-1.5 rounded-lg disabled:opacity-40" disabled={Boolean(ag.bloqueios.alterar)} onclick={() => abrir('alterar')}>Alterar unidade</button>
      <button type="button" class="text-xs font-bold text-calper-dark border border-gray-300 px-3 py-1.5 rounded-lg disabled:opacity-40" disabled={Boolean(ag.bloqueios.remarcar)} onclick={() => abrir('remarcar')}>Remarcar</button>
      <button type="button" class="text-xs font-bold text-red-700 border border-red-300 px-3 py-1.5 rounded-lg disabled:opacity-40" disabled={Boolean(ag.bloqueios.desmarcar)} onclick={() => abrir('desmarcar')}>Desmarcar</button>
    </div>
    {#if ag.bloqueios.alterar || ag.bloqueios.remarcar}
      <div class="text-[11px] text-gray-500" data-testid="acoes-bloqueio">
        {#each bloqueadas as b}
          <div>Alterar e remarcar indisponíveis: {b}.</div>
        {/each}
      </div>
    {/if}
  {/if}

  {#if ag.trocouUnidade && (ag.temIdentidadeEnviada || ag.temProcuracaoEnviada)}
    <div class="rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs px-3 py-2" data-testid="aviso-troca-unidade">
      A unidade foi trocada (antes: {ag.trocouUnidade.de}). O documento de identidade e a procuração enviados no agendamento
      pertencem à unidade antiga — <strong>peça novo envio para a unidade nova</strong>. O arquivo antigo foi mantido.
    </div>
  {/if}
  {#if aviso}
    <div class="rounded-lg bg-green-50 border border-green-200 text-green-800 text-xs px-3 py-2" role="status" data-testid="aviso-acao">{aviso}</div>
  {/if}
</div>

<!-- ALTERAR -->
{#if dialogo === 'alterar'}
  <dialog bind:this={elemento.alterar} class="rounded-2xl p-0 w-[calc(100%-2rem)] max-w-md backdrop:bg-black/50 m-auto" aria-labelledby="t-alterar" onclose={() => (dialogo = null)}>
    <form method="POST" action="/admin/quem-agendou?/alterar" use:enhance={aoEnviar} class="p-6 flex flex-col gap-3">
      <input type="hidden" name="agendamentoId" value={ag.id} />
      <h2 id="t-alterar" class="text-lg font-extrabold text-calper-dark">Alterar a unidade do agendamento</h2>
      <p class="text-sm text-gray-600">Agora: <strong>{ag.unidade}</strong> — {rotuloDataHora(ag.dataHora)}. A data e a hora continuam as mesmas.</p>
      <label for="unidadeNova" class="text-xs font-semibold text-gray-500">Unidade nova (só aparecem as que podem ser agendadas)</label>
      <select id="unidadeNova" name="unidadeId" class="input !py-2 text-sm" required>
        <option value="">selecione</option>
        {#each unidades as u (u.id)}
          <option value={u.id}>{u.rotulo}</option>
        {/each}
      </select>
      {#if ag.temIdentidadeEnviada || ag.temProcuracaoEnviada}
        <div class="rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs px-3 py-2">
          O documento de identidade e a procuração enviados neste agendamento pertencem à unidade antiga. Depois da troca, peça
          novo envio para a unidade nova. O arquivo antigo não é apagado.
        </div>
      {/if}
      {#if erro}<div class="text-sm font-semibold text-red-600" role="alert">{erro}</div>{/if}
      <div class="flex gap-2 mt-1">
        <button type="button" class="btn-outline flex-1 text-sm !py-2.5" onclick={fechar}>Cancelar</button>
        <button type="submit" class="btn-primary flex-1 text-sm !py-2.5" disabled={enviando}>{enviando ? 'Trocando…' : 'Trocar unidade'}</button>
      </div>
    </form>
  </dialog>
{/if}

<!-- REMARCAR -->
{#if dialogo === 'remarcar'}
  <dialog bind:this={elemento.remarcar} class="rounded-2xl p-0 w-[calc(100%-2rem)] max-w-md backdrop:bg-black/50 m-auto" aria-labelledby="t-remarcar" onclose={() => (dialogo = null)}>
    <form method="POST" action="/admin/quem-agendou?/remarcar" use:enhance={aoEnviar} class="p-6 flex flex-col gap-3">
      <input type="hidden" name="agendamentoId" value={ag.id} />
      <h2 id="t-remarcar" class="text-lg font-extrabold text-calper-dark">Remarcar o agendamento</h2>
      <p class="text-sm text-gray-600">Agora: <strong>{ag.unidade}</strong> — {rotuloDataHora(ag.dataHora)}. A unidade continua a mesma.</p>
      <label for="dataNova" class="text-xs font-semibold text-gray-500">Data (só dias abertos na agenda)</label>
      <select id="dataNova" name="data" class="input !py-2 text-sm" bind:value={dataEscolhida} required>
        <option value="">selecione</option>
        {#each agenda as d (d.data)}
          <option value={d.data}>{rotuloData(d.data)}</option>
        {/each}
      </select>
      <label for="horarioNovo" class="text-xs font-semibold text-gray-500">Horário (só os que têm vaga)</label>
      <select id="horarioNovo" name="horario" class="input !py-2 text-sm" required disabled={!dataEscolhida}>
        <option value="">{dataEscolhida ? 'selecione' : 'escolha a data primeiro'}</option>
        {#each horariosDoDia as h (h.horario)}
          <option value={h.horario}>{h.horario} ({h.restantes} vaga{h.restantes === 1 ? '' : 's'})</option>
        {/each}
      </select>
      {#if erro}<div class="text-sm font-semibold text-red-600" role="alert">{erro}</div>{/if}
      <div class="flex gap-2 mt-1">
        <button type="button" class="btn-outline flex-1 text-sm !py-2.5" onclick={fechar}>Cancelar</button>
        <button type="submit" class="btn-primary flex-1 text-sm !py-2.5" disabled={enviando}>{enviando ? 'Remarcando…' : 'Remarcar'}</button>
      </div>
    </form>
  </dialog>
{/if}

<!-- DESMARCAR (confirmação com unidade, data, hora e quem agendou) -->
{#if dialogo === 'desmarcar'}
  <dialog bind:this={elemento.desmarcar} class="rounded-2xl p-0 w-[calc(100%-2rem)] max-w-md backdrop:bg-black/50 m-auto" aria-labelledby="t-desmarcar" onclose={() => (dialogo = null)}>
    <form method="POST" action="/admin/quem-agendou?/desmarcar" use:enhance={aoEnviar} class="p-6 flex flex-col gap-3">
      <input type="hidden" name="agendamentoId" value={ag.id} />
      <h2 id="t-desmarcar" class="text-lg font-extrabold text-red-700">Desmarcar este agendamento?</h2>
      <dl class="text-sm grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-xl bg-gray-50 p-3" data-testid="resumo-desmarcar">
        <dt class="text-gray-500">Unidade</dt><dd class="font-bold text-calper-dark">{ag.unidade}</dd>
        <dt class="text-gray-500">Data e hora</dt><dd class="font-bold text-calper-dark">{rotuloDataHora(ag.dataHora)}</dd>
        <dt class="text-gray-500">Agendado por</dt><dd class="font-bold text-calper-dark">{ag.nome ?? '—'}</dd>
      </dl>
      <p class="text-xs text-gray-500">O registro não é apagado: o agendamento fica como "cancelado", a unidade volta a ficar disponível e a vaga do horário é liberada.</p>
      <label for="motivo" class="text-xs font-semibold text-gray-500">Motivo (obrigatório)</label>
      <textarea id="motivo" name="motivo" rows="3" maxlength={MOTIVO_MAXIMO} class="input text-sm" bind:value={motivo} required placeholder="Ex.: o cliente pediu para cancelar"></textarea>
      {#if erro}<div class="text-sm font-semibold text-red-600" role="alert">{erro}</div>{/if}
      <div class="flex gap-2 mt-1">
        <button type="button" class="btn-outline flex-1 text-sm !py-2.5" onclick={fechar}>Voltar</button>
        <button type="submit" class="flex-1 text-sm !py-2.5 rounded-xl font-semibold bg-red-600 text-white disabled:opacity-50" disabled={enviando || motivo.trim().length < 3}>{enviando ? 'Desmarcando…' : 'Confirmar: desmarcar'}</button>
      </div>
    </form>
  </dialog>
{/if}
