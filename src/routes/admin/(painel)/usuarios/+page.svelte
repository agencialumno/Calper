<script>
  import { enhance } from '$app/forms';
  import AvatarEquipe from '$lib/components/AvatarEquipe.svelte';
  import AvisoSutil from '$lib/components/AvisoSutil.svelte';

  let { data, form } = $props();

  function quando(iso) {
    return iso
      ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
      : '—';
  }

  // o seletor de perfil envia sozinho ao mudar
  const aoMudarPerfil = (e) => e.currentTarget.form.requestSubmit();
</script>

<svelte:head>
  <title>Usuários — Calper</title>
</svelte:head>

<div class="p-5 md:p-8 max-w-5xl">
  <h1 class="text-xl font-bold text-calper-dark">Usuários da equipe</h1>
  <p class="text-sm text-gray-500 mt-0.5 mb-5">
    {data.usuarios.length} usuário(s) · {data.totalOnline} online agora (atividade nos últimos 5 minutos)
  </p>

  {#if form?.erro}<div class="mb-4"><AvisoSutil>{form.erro}</AvisoSutil></div>{/if}
  {#if form?.sucesso}
    <div class="bg-green-50 border border-green-100 text-green-700 text-sm rounded-xl px-4 py-3 mb-4">{form.sucesso}</div>
  {/if}
  {#if form?.senhaTemporaria}
    <div class="bg-amber-50 border border-amber-200 text-amber-900 text-sm rounded-xl px-4 py-3 mb-4">
      Senha temporária de <strong>{form.senhaTemporaria.nome}</strong> ({form.senhaTemporaria.email}):
      <code class="font-mono font-bold text-base select-all">{form.senhaTemporaria.senha}</code><br />
      Ela aparece só desta vez. Passe para a pessoa, que deve trocá-la em "Minha conta" logo após entrar.
    </div>
  {/if}

  <div class="card divide-y divide-gray-100">
    {#each data.usuarios as u (u.id)}
      <div class="p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-3 md:gap-5 {u.ativo ? '' : 'opacity-60'}">
        <div class="flex items-center gap-3 min-w-0 md:w-72 shrink-0">
          <AvatarEquipe id={u.id} nome={u.nome} fotoVersao={u.fotoVersao} classe="w-10 h-10 text-sm" />
          <div class="min-w-0">
            <div class="text-sm font-bold text-calper-dark truncate">{u.nome}</div>
            <div class="text-xs text-gray-500 truncate">{u.email}</div>
          </div>
        </div>

        <div class="text-xs md:w-56 shrink-0">
          {#if u.online}
            <span class="font-bold text-green-700 bg-green-50 rounded-full px-2.5 py-1">● online agora</span>
          {:else if u.sessoes > 0}
            <span class="font-bold text-amber-700 bg-amber-50 rounded-full px-2.5 py-1">sessão aberta</span>
          {:else if !u.ativo}
            <span class="font-bold text-amber-800 bg-amber-100 rounded-full px-2.5 py-1">inativa — aguardando ativação</span>
          {:else}
            <span class="text-gray-400">sem sessão</span>
          {/if}
          {#if u.sessoes > 0}
            <div class="text-gray-500 mt-1.5">
              logado desde {quando(u.logadoDesde)} · última atividade {quando(u.ultimaAtividade)}
              {#if u.sessoes > 1}· {u.sessoes} sessões{/if}
            </div>
          {/if}
        </div>

        <div class="flex flex-wrap items-center gap-3 md:ml-auto">
          <form method="POST" action="?/alterarPerfil" use:enhance={() => async ({ update }) => update({ reset: false })}>
            <input type="hidden" name="id" value={u.id} />
            <select name="perfil" class="input !py-2 text-sm" aria-label="Perfil de {u.nome}" onchange={aoMudarPerfil}>
              {#each data.perfis as p}
                <option value={p.valor} selected={p.valor === u.perfil}>{p.rotulo}</option>
              {/each}
            </select>
          </form>

          <form method="POST" action="?/redefinirSenha" use:enhance onsubmit={(e) => !confirm(`Gerar uma nova senha temporária para ${u.nome}? As sessões dela serão encerradas.`) && e.preventDefault()}>
            <input type="hidden" name="id" value={u.id} />
            <button type="submit" class="text-xs font-semibold text-gray-600 hover:text-calper-red">Redefinir senha</button>
          </form>
          {#if u.sessoes > 0}
            <form method="POST" action="?/encerrarSessoes" use:enhance>
              <input type="hidden" name="id" value={u.id} />
              <button type="submit" class="text-xs font-semibold text-gray-600 hover:text-calper-red">Encerrar sessões</button>
            </form>
          {/if}
          <form method="POST" action="?/alternarAtivo" use:enhance>
            <input type="hidden" name="id" value={u.id} />
            <button type="submit" class="text-xs font-semibold {u.ativo ? 'text-gray-400 hover:text-calper-red' : 'text-calper-red'}">
              {u.ativo ? 'Desativar' : 'Reativar'}
            </button>
          </form>
        </div>
      </div>
    {/each}
  </div>

  <div class="card p-5 mt-6 text-sm text-gray-600 leading-relaxed">
    <div class="font-bold text-calper-dark mb-2">O que cada perfil faz</div>
    <ul class="list-disc pl-5 flex flex-col gap-1">
      <li><strong>Admin:</strong> acesso total, gerencia usuários e perfis, vê os logs de auditoria.</li>
      <li><strong>Supervisor:</strong> altera unidades, status (pagamento, vistoria, escritura), documentos e agenda; não gerencia usuários e não vê os logs.</li>
      <li><strong>Colaborador:</strong> somente leitura; faz os atendimentos presenciais; não vê questionários, atualizações nem empreendimentos.</li>
    </ul>
  </div>
</div>
