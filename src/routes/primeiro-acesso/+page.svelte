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
  let aceitouTermo = false;
  let termoAberto = false;
  let enviando = false;
  let tentouEnviar = false;

  $: senhaForteOk = senhaAceitavel(novaSenha);
  $: senhasConferem = novaSenha.length > 0 && novaSenha === confirmarSenha;
  $: mostrarAvisoForca = tentouEnviar && !senhaForteOk;
  $: mostrarAvisoConfirmacao = tentouEnviar && senhaForteOk && !senhasConferem;
  $: mostrarAvisoTermo = tentouEnviar && !aceitouTermo;

  function aoSubmeter({ cancel }) {
    tentouEnviar = true;
    if (!senhaForteOk || !senhasConferem || !aceitouTermo) {
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

      <div class="border border-gray-100 rounded-xl p-3.5 bg-gray-50">
        <label class="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            name="aceitouTermo"
            bind:checked={aceitouTermo}
            class="mt-0.5 w-4 h-4 accent-calper-red shrink-0"
          />
          <span class="text-xs text-gray-600 leading-relaxed">
            Li e aceito os termos de uso e a
            <button
              type="button"
              onclick={() => (termoAberto = !termoAberto)}
              class="font-bold text-calper-red underline"
            >
              política de privacidade
            </button>
            da Calper.
          </span>
        </label>

        {#if termoAberto}
          <div class="text-[11px] text-gray-500 leading-relaxed mt-3 pt-3 border-t border-gray-200">
            A Calper coleta e utiliza seus dados (nome, CPF, e-mail e, quando aplicável,
            documento de identificação enviado para agendamentos) exclusivamente para
            viabilizar o relacionamento entre você e a construtora: autenticação, agendamentos,
            check-in presencial, comunicações sobre sua unidade e andamento da obra. Dados
            financeiros e contratuais permanecem no sistema de gestão da Calper, fora desta
            plataforma. Seus dados não são compartilhados com terceiros para fins comerciais.
            Em conformidade com a LGPD (Lei nº 13.709/2018), você pode solicitar acesso,
            correção ou exclusão dos seus dados a qualquer momento junto à equipe Calper.
          </div>
        {/if}
      </div>

      {#if mostrarAvisoTermo}
        <AvisoSutil>Você precisa aceitar o termo de consentimento para continuar.</AvisoSutil>
      {/if}

      <SubmitButton loading={enviando}>Salvar e continuar</SubmitButton>
    </form>
  </div>
</div>