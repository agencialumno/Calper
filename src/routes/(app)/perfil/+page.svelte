<script>
  import { enhance } from '$app/forms';
  import SubmitButton from '$lib/components/SubmitButton.svelte';
  import PasswordStrength from '$lib/components/PasswordStrength.svelte';
  import BackLink from '$lib/components/BackLink.svelte';
  import { formatarCpf } from '$lib/cpf.js';

  let { data, form } = $props();
  let novaSenha = $state('');
  let enviando = $state(false);

  function aoSubmeter() {
    enviando = true;
    return async ({ update, result }) => {
      await update({ reset: result.type === 'success' });
      if (result.type === 'success') novaSenha = '';
      enviando = false;
    };
  }
</script>

<svelte:head>
  <title>Meu perfil — Calper</title>
</svelte:head>

<div class="max-w-2xl mx-auto px-5 md:px-8 py-8 md:py-12">
  <BackLink href="/painel" label="Painel" />
  <h1 class="text-2xl md:text-3xl font-extrabold text-calper-dark mt-3 mb-8">Meu perfil</h1>

  <section class="card p-6 md:p-7 mb-6">
    <h2 class="text-base font-bold text-calper-dark mb-5">Dados pessoais</h2>
    <dl class="grid gap-5 sm:grid-cols-2">
      <div>
        <dt class="text-xs font-semibold text-gray-400 tracking-wide uppercase mb-1">Nome</dt>
        <dd class="text-base text-calper-dark">{data.investidor.nome}</dd>
      </div>
      <div>
        <dt class="text-xs font-semibold text-gray-400 tracking-wide uppercase mb-1">CPF</dt>
        <dd class="text-base text-calper-dark">{formatarCpf(data.investidor.cpf)}</dd>
      </div>
      <div class="sm:col-span-2">
        <dt class="text-xs font-semibold text-gray-400 tracking-wide uppercase mb-1">E-mail de contato</dt>
        <dd class="text-base text-calper-dark">{data.investidor.email || '—'}</dd>
        <dd class="text-xs text-gray-400 mt-1">Para alterar o e-mail, fale com o time Calper.</dd>
      </div>
    </dl>
  </section>

  <section class="card p-6 md:p-7 mb-6">
    <h2 class="text-base font-bold text-calper-dark mb-1">Minhas unidades</h2>
    <p class="text-sm text-gray-500 mb-4">Troque de unidade a qualquer momento pelo topo da página.</p>
    <ul class="flex flex-col gap-2">
      {#each data.unidades as u (u.id)}
        <li class="flex items-center justify-between gap-3 rounded-xl border border-gray-100 px-4 py-3">
          <div class="min-w-0">
            <div class="text-sm font-bold text-calper-dark">Unidade {u.numero} — Bloco {u.bloco}</div>
            <div class="text-xs text-gray-500">{u.empreendimento}</div>
          </div>
          {#if u.id === data.unidade?.id}
            <span class="text-xs font-bold text-calper-red shrink-0">em uso</span>
          {/if}
        </li>
      {/each}
    </ul>
  </section>

  <section class="card p-6 md:p-7">
    <h2 class="text-base font-bold text-calper-dark mb-5">Alterar senha</h2>

    {#if form?.sucesso}
      <div class="bg-green-50 border border-green-100 text-green-700 text-sm rounded-xl px-4 py-3 mb-5">
        Senha alterada com sucesso.
      </div>
    {/if}
    {#if form?.erro}
      <div class="bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3 mb-5">{form.erro}</div>
    {/if}

    <form method="POST" action="?/senha" use:enhance={aoSubmeter} class="flex flex-col gap-5">
      <div>
        <label for="senhaAtual" class="block text-sm font-semibold text-calper-dark mb-1.5">Senha atual</label>
        <input id="senhaAtual" name="senhaAtual" type="password" class="input" required />
      </div>
      <div>
        <label for="novaSenha" class="block text-sm font-semibold text-calper-dark mb-1.5">Nova senha</label>
        <input id="novaSenha" name="novaSenha" type="password" class="input" bind:value={novaSenha} required />
        <PasswordStrength senha={novaSenha} />
      </div>
      <div>
        <label for="confirmarSenha" class="block text-sm font-semibold text-calper-dark mb-1.5">
          Confirmar nova senha
        </label>
        <input id="confirmarSenha" name="confirmarSenha" type="password" class="input" required />
      </div>
      <SubmitButton loading={enviando}>Salvar nova senha</SubmitButton>
    </form>
  </section>
</div>
