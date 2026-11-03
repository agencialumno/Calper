<script>
  import { enhance } from '$app/forms';
  import SubmitButton from '$lib/components/SubmitButton.svelte';
  import AvisoSutil from '$lib/components/AvisoSutil.svelte';

  let { data, form } = $props();
  import { autoAtualizar } from '$lib/autoAtualizar.svelte.js';
  // a página se atualiza sozinha (novo agendamento, cancelamento, check-in, mudança de status)
  const auto = autoAtualizar();
  let salvando = $state('');
  let novoDia = $state('');

  const formatarData = (d) => d.split('-').reverse().join('/');
  const diaDaSemana = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'UTC' });

  function aoSubmeter(chave) {
    return () => {
      salvando = chave;
      return async ({ update }) => {
        await update({ reset: false });
        salvando = '';
      };
    };
  }
</script>

<svelte:head>
  <title>Agenda de vistoria — Calper</title>
</svelte:head>

<div class="p-5 md:p-8 max-w-4xl">
  <div class="flex items-baseline gap-3 flex-wrap">
    <h1 class="text-2xl font-extrabold text-calper-dark">Agenda de vistoria</h1>
    <span class="text-[11px] text-gray-400" data-testid="auto-atualizacao">
      Atualiza sozinha a cada 20 s · última atualização {auto.em.toLocaleTimeString('pt-BR')}
    </span>
  </div>
  <p class="text-sm text-gray-500 mt-1 mb-4">Só os dias abertos aqui aparecem para o cliente.</p>

  {#if !data.funcionario.podeEditar}
    <div class="mb-4 rounded-xl bg-gray-100 text-gray-600 text-sm px-4 py-3">Seu perfil é somente leitura: você vê a agenda, mas não altera dias, horários e limites.</div>
  {/if}
  <fieldset disabled={!data.funcionario.podeEditar} class="contents">

  {#if form?.sucesso}
    <div class="bg-green-50 border border-green-100 text-green-700 text-sm rounded-xl px-4 py-3 mb-4">{form.sucesso}</div>
  {/if}
  {#if form?.erro}
    <div class="mb-4"><AvisoSutil>{form.erro}</AvisoSutil></div>
  {/if}

  <div class="rounded-lg bg-gray-50 text-gray-500 text-xs px-4 py-3 mb-6" data-testid="padrao-vistoria">
    Horários ({data.config.horarios.join(', ')}) e limite padrão ({data.config.limitePorHora} por hora) vêm do padrão geral da <a href="/admin/agenda" class="font-bold text-calper-red">Agenda de entrega de chaves</a>. Aqui você abre os dias de vistoria e ajusta os limites só da vistoria. A agenda de entrega não é afetada.
  </div>

  <!-- dias -->
  <div class="flex items-end justify-between gap-3 flex-wrap mb-3">
    <h2 class="text-lg font-bold text-calper-dark">Dias</h2>
    <form method="POST" action="?/adicionarDia" use:enhance={aoSubmeter('novo')} class="flex items-end gap-2">
      <div>
        <label for="novoDia" class="block text-xs font-semibold text-gray-500 mb-1">Abrir um novo dia</label>
        <input id="novoDia" name="data" type="date" class="input !py-2 text-sm" bind:value={novoDia} required />
      </div>
      <button type="submit" class="btn-outline text-sm !py-2.5" disabled={salvando === 'novo'}>+ Adicionar</button>
    </form>
  </div>

  {#if data.dias.length === 0}
    <div class="card p-8 text-center text-sm text-gray-500">Nenhum dia de vistoria aberto: a página pública de vistoria não tem datas disponíveis.</div>
  {/if}

  <div class="flex flex-col gap-4">
    {#each data.dias as d (d.id)}
      <form method="POST" action="?/salvarDia" use:enhance={aoSubmeter(d.id)} class="card p-5 md:p-6 flex flex-col gap-4">
        <input type="hidden" name="id" value={d.id} />
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div class="text-base font-bold text-calper-dark">{formatarData(d.data)}</div>
            <div class="text-xs text-gray-500 capitalize">{diaDaSemana(d.data)}</div>
          </div>
          <label class="flex items-center gap-2 text-sm font-semibold text-calper-dark">
            <input type="checkbox" name="aberto" checked={d.aberto} class="accent-calper-red w-4 h-4" />
            Aberto para vistoria
          </label>
        </div>

        <div class="grid sm:grid-cols-[12rem_1fr] gap-4 items-start">
          <div>
            <label class="block text-xs font-semibold text-gray-500 mb-1" for="lim-{d.id}">Limite por hora neste dia</label>
            <input id="lim-{d.id}" name="limitePorHora" type="number" min="0" max="99" class="input !py-2 text-sm" value={d.limitePorHora ?? ''} placeholder="padrão ({data.config.limitePorHora})" />
          </div>
          <div>
            <div class="text-xs font-semibold text-gray-500 mb-1">Por horário (vazio = usa o limite do dia) — ocupados / limite de vistoria</div>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {#each d.horarios as h (h.horario)}
                <label class="rounded-xl border border-gray-200 px-3 py-2 text-sm">
                  <span class="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span class="font-bold text-calper-dark">{h.horario}</span>
                    <span class={h.ocupados >= h.limite ? 'font-bold text-calper-red' : ''}>{h.ocupados}/{h.limite}</span>
                  </span>
                  <input name="limite_{h.horario}" type="number" min="0" max="99" class="input !py-1.5 text-sm" value={h.sobreposto ? h.limite : ''} placeholder={String(h.limite)} />
                </label>
              {/each}
            </div>
          </div>
        </div>

        <div class="flex items-center gap-3 flex-wrap">
          <div class="w-44"><SubmitButton loading={salvando === d.id}>Salvar dia</SubmitButton></div>
        </div>
      </form>
    {/each}
  </div>
  </fieldset>
</div>
