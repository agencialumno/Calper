<script>
  import { enhance } from '$app/forms';
  import SubmitButton from '$lib/components/SubmitButton.svelte';

  let { form } = $props();
  let entrando = $state(false);

  function aoSubmeter() {
    entrando = true;
    return async ({ update }) => {
      await update();
      entrando = false;
    };
  }
</script>

<svelte:head>
  <title>Entrar — Painel Calper</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-[#f6f6f7] px-6 py-12">
  <div class="card w-full max-w-sm p-8">
    <img src="/logo.png" alt="Calper" class="h-8 mb-7" />
    <h1 class="text-xl font-bold text-calper-dark mb-1">Painel da equipe</h1>
    <p class="text-sm text-gray-500 mb-7">Acesso restrito ao time Calper</p>

    <form method="POST" use:enhance={aoSubmeter} class="flex flex-col gap-4">
      {#if form?.erro}
        <div class="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-3.5 py-3">
          {form.erro}
        </div>
      {/if}

      <div>
        <label for="email" class="block text-sm font-semibold text-calper-dark mb-1.5">E-mail</label>
        <input
          id="email"
          name="email"
          class="input"
          type="email"
          placeholder="seuusuario@calper.com.br"
          value={form?.email ?? ''}
          required
        />
      </div>
      <div>
        <label for="senha" class="block text-sm font-semibold text-calper-dark mb-1.5">Senha</label>
        <input id="senha" name="senha" class="input" type="password" placeholder="••••••••" required />
      </div>
      <div class="mt-2">
        <SubmitButton loading={entrando}>Entrar</SubmitButton>
      </div>
    </form>
  </div>
</div>