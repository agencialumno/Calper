<script>
  import { enhance } from '$app/forms';

  /** @type {import('./$types').ActionData} */
  export let form;
</script>

<svelte:head>
  <title>Primeiro acesso — Calper</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center bg-gray-50 px-6 py-12">
  <div class="card w-full max-w-sm p-7">
    <h1 class="text-xl font-bold text-calper-dark mb-1">Defina sua senha</h1>
    <p class="text-sm text-gray-500 mb-6">
      Este é o seu primeiro acesso — crie uma senha nova para continuar
    </p>

    <form method="POST" use:enhance class="flex flex-col gap-4">
      {#if form?.erro}
        <div class="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-3.5 py-3">
          {form.erro}
        </div>
      {/if}

      <div>
        <label for="novaSenha" class="block text-sm font-semibold text-calper-dark mb-1.5"
          >Nova senha</label
        >
        <input
          id="novaSenha"
          name="novaSenha"
          class="input"
          type="password"
          placeholder="Mínimo de 8 caracteres"
          required
          minlength="8"
        />
      </div>
      <div>
        <label for="confirmarSenha" class="block text-sm font-semibold text-calper-dark mb-1.5"
          >Confirmar senha</label
        >
        <input
          id="confirmarSenha"
          name="confirmarSenha"
          class="input"
          type="password"
          placeholder="Repita a senha"
          required
          minlength="8"
        />
      </div>
      <button type="submit" class="btn-primary mt-2">Salvar e continuar</button>
    </form>
  </div>
</div>
