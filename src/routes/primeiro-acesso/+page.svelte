<script>
  import { enhance } from '$app/forms';
  import SubmitButton from '$lib/components/SubmitButton.svelte';
  import PasswordStrength from '$lib/components/PasswordStrength.svelte';
  import AvisoSutil from '$lib/components/AvisoSutil.svelte';
  import { senhaAceitavel } from '$lib/password.js';

  /** @type {import('./$types').ActionData} */
  export let form;

  let novaSenha = '';
  let confirmarSenha = '';
  let enviando = false;
  let tentouEnviar = false;

  $: senhaForteOk = senhaAceitavel(novaSenha);
  $: senhasConferem = novaSenha.length > 0 && novaSenha === confirmarSenha;
  $: mostrarAvisoForca = tentouEnviar && !senhaForteOk;
  $: mostrarAvisoConfirmacao = tentouEnviar && senhaForteOk && !senhasConferem;

  function aoSubmeter({ cancel }) {
    tentouEnviar = true;
    if (!senhaForteOk || !senhasConferem) {
      cancel();
      return;
    }
    enviando = true;
    return async ({ update }) => {
      await update();
      enviando = false;
    };
  }
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

    <form method="POST" use:enhance={aoSubmeter} class="flex flex-col gap-4">
      {#if form?.erro}
        <AvisoSutil>{form.erro}</AvisoSutil>
      {/if}

      <div>
        <label for="novaSenha" class="block text-sm font-semibold text-calper-dark mb-1.5">
          Nova senha
        </label>
        <input
          id="novaSenha"
          name="novaSenha"
          class="input"
          type="password"
          placeholder="Crie uma senha forte"
          bind:value={novaSenha}
          required
        />
        <PasswordStrength senha={novaSenha} />
      </div>

      {#if mostrarAvisoForca}
        <AvisoSutil>
          Sua senha ainda não atingiu o nível mínimo exigido (forte). Complete os requisitos
          acima destacados em verde para continuar.
        </AvisoSutil>
      {/if}

      <div>
        <label for="confirmarSenha" class="block text-sm font-semibold text-calper-dark mb-1.5">
          Confirmar senha
        </label>
        <input
          id="confirmarSenha"
          name="confirmarSenha"
          class="input"
          type="password"
          placeholder="Repita a senha"
          bind:value={confirmarSenha}
          required
        />
      </div>

      {#if mostrarAvisoConfirmacao}
        <AvisoSutil>As senhas digitadas não coincidem.</AvisoSutil>
      {/if}

      <SubmitButton loading={enviando}>Salvar e continuar</SubmitButton>
    </form>
  </div>
</div>
