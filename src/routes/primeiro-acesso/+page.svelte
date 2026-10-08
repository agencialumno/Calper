<script>
  import { enhance } from '$app/forms';
  import SubmitButton from '$lib/components/SubmitButton.svelte';
  import PasswordStrength from '$lib/components/PasswordStrength.svelte';
  import AvisoSutil from '$lib/components/AvisoSutil.svelte';
  import { senhaAceitavel } from '$lib/password.js';

  /** @type {import('./$types').ActionData} */
  export let form;
  /** @type {import('./$types').PageData} */
  export let data;

  let novaSenha = '';
  let confirmarSenha = '';
  let email = data.emailAtual ?? '';
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
    <h1 class="text-xl font-bold text-calper-dark mb-1">Primeiro acesso</h1>
    <p class="text-sm text-gray-500 mb-6">
      Crie sua senha e confirme seu e-mail de contato para continuar
    </p>

    <form method="POST" use:enhance={aoSubmeter} class="flex flex-col gap-4">
      {#if form?.erro}
        <AvisoSutil>{form.erro}</AvisoSutil>
      {/if}

      <div>
        <label for="email" class="block text-sm font-semibold text-calper-dark mb-1.5"> E-mail de contato </label>
        <input
          id="email"
          name="email"
          class="input"
          type="email"
          placeholder="seu@email.com"
          bind:value={email}
          required
        />
        <p class="text-xs text-gray-400 mt-1.5">
          É pra esse e-mail que vamos mandar confirmações de agendamento, lembretes e novidades da obra.
          Depois de definido, só o time Calper pode alterar.
        </p>
      </div>

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