<script>
  import { enhance } from '$app/forms';
  import SubmitButton from '$lib/components/SubmitButton.svelte';
  import PasswordStrength from '$lib/components/PasswordStrength.svelte';

  let { form } = $props();

  let nome = $state(form?.valores?.nome ?? '');
  let email = $state(form?.valores?.email ?? '');
  let senha = $state('');
  let criando = $state(false);

  function aoSubmeter() {
    criando = true;
    return async ({ update }) => {
      await update({ reset: false });
      criando = false;
    };
  }
</script>

<svelte:head>
  <title>Cadastro da equipe — Calper</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-[#f6f6f7] px-6 py-12">
  <div class="card w-full max-w-sm p-8">
    <img src="/logo.png" alt="Calper" class="h-16 w-auto mb-7" />
    <h1 class="text-xl font-bold text-calper-dark mb-1">Cadastro da equipe</h1>
    {#if form?.pendente}
      <div class="text-sm text-green-800 bg-green-50 border border-green-100 rounded-xl px-4 py-4" data-testid="cadastro-pendente">
        <div class="font-bold mb-1">Pedido enviado</div>
        A conta de <strong>{form.email}</strong> foi criada, mas ainda está <strong>inativa</strong>: um admin da Calper precisa
        ativá-la antes do primeiro acesso. Você poderá entrar com este e-mail e a senha que acabou de criar.
      </div>
    {:else}
    <p class="text-sm text-gray-500 mb-7">Peça acesso ao painel Calper. Um admin ativa a conta antes do primeiro acesso.</p>

    <form method="POST" use:enhance={aoSubmeter} class="flex flex-col gap-4">
      {#if form?.erro}
        <div class="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-3.5 py-3">{form.erro}</div>
      {/if}

      <div>
        <label for="nome" class="block text-sm font-semibold text-calper-dark mb-1.5">Nome completo</label>
        <input id="nome" name="nome" class="input" bind:value={nome} required />
      </div>
      <div>
        <label for="email" class="block text-sm font-semibold text-calper-dark mb-1.5">E-mail</label>
        <input id="email" name="email" class="input" type="email" placeholder="seuusuario@calper.com.br" bind:value={email} required />
      </div>
      <div>
        <label for="senha" class="block text-sm font-semibold text-calper-dark mb-1.5">Senha</label>
        <input id="senha" name="senha" class="input" type="password" bind:value={senha} required />
        <PasswordStrength {senha} />
      </div>
      <div>
        <label for="confirmarSenha" class="block text-sm font-semibold text-calper-dark mb-1.5">Confirmar senha</label>
        <input id="confirmarSenha" name="confirmarSenha" class="input" type="password" required />
      </div>
      <div class="mt-2">
        <SubmitButton loading={criando}>Pedir acesso</SubmitButton>
      </div>
    </form>
    {/if}

    <p class="text-sm text-gray-500 mt-6 text-center">
      Já tem conta? <a href="/admin/login" class="font-bold text-calper-red">Entrar</a>
    </p>
  </div>
</div>
