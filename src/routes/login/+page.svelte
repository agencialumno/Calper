<script>
  import { enhance } from '$app/forms';
  import SubmitButton from '$lib/components/SubmitButton.svelte';

  /** @type {import('./$types').ActionData} */
  export let form;

  let entrando = false;
  function aoSubmeter() {
    entrando = true;
    return async ({ update }) => {
      await update();
      entrando = false;
    };
  }
</script>

<svelte:head>
  <title>Entrar — Calper</title>
</svelte:head>

<div class="min-h-screen flex flex-wrap">
  <!-- painel de marca -->
  <div
    class="flex-1 min-w-[320px] basis-[420px] relative overflow-hidden flex flex-col justify-between text-white px-10 py-16 sm:px-14"
  >
    <div
      class="absolute inset-0 bg-cover bg-center opacity-40"
      style="background-image: url('/background-login.jpg')"
    ></div>
    <div
      class="absolute inset-0"
      style="background: linear-gradient(165deg, #282e35 10%, rgba(40,46,53,.78) 55%, rgba(221,4,23,.55) 130%)"
    ></div>

    <div class="relative">
      <img src="/logo-branca.png" alt="Calper" class="h-8" />
    </div>
    <div class="relative max-w-sm">
      <p class="text-3xl font-bold leading-snug mb-4">
        Acompanhe a jornada da sua unidade do início ao fim.
      </p>
      <p class="text-sm text-gray-200 leading-relaxed">
        Agendamentos, dossiê e atualizações da obra em um só lugar.
      </p>
    </div>
    <p class="relative text-xs text-gray-300">© Calper — plataforma do investidor</p>
  </div>

  <!-- formulário -->
  <div class="flex-1 min-w-[320px] basis-[420px] flex items-center justify-center px-8 py-12">
    <div class="w-full max-w-sm">
      <h1 class="text-2xl font-bold text-calper-dark mb-1">Entrar</h1>
      <p class="text-sm text-gray-500 mb-9">Acesse com seu CPF para ver sua unidade</p>

      <form method="POST" use:enhance={aoSubmeter} class="flex flex-col gap-4">
        {#if form?.erro}
          <div class="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-3.5 py-3">
            {form.erro}
          </div>
        {/if}

        <div>
          <label for="cpf" class="block text-sm font-semibold text-calper-dark mb-1.5">CPF</label>
          <input
            id="cpf"
            name="cpf"
            class="input"
            type="text"
            inputmode="numeric"
            placeholder="000.000.000-00"
            value={form?.cpf ?? ''}
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
        <a href="/esqueci-senha" class="text-sm text-calper-red text-center mt-1">Esqueci minha senha</a>
      </form>

      <p class="text-xs text-gray-400 leading-relaxed mt-8 pt-6 border-t border-gray-100">
        Primeiro acesso? Use a senha temporária enviada por e-mail.
      </p>

      <a
        href="/admin/login"
        class="block text-center text-xs font-semibold text-gray-500 hover:text-calper-red mt-4 underline underline-offset-2"
      >
        Sou da equipe Calper
      </a>
    </div>
  </div>
</div>