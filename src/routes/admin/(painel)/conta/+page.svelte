<script>
  import { enhance } from '$app/forms';
  import SubmitButton from '$lib/components/SubmitButton.svelte';
  import AvisoSutil from '$lib/components/AvisoSutil.svelte';
  import AvatarEquipe from '$lib/components/AvatarEquipe.svelte';
  import PasswordStrength from '$lib/components/PasswordStrength.svelte';

  let { data, form } = $props();

  let novaSenha = $state('');
  let trocando = $state(false);
  let enviandoFoto = $state(false);
  let erroLocalFoto = $state('');

  // confere o tamanho no navegador antes de enviar (o servidor confere de novo)
  function aoEscolherFoto(e) {
    const arquivo = e.currentTarget.files?.[0];
    erroLocalFoto = '';
    if (!arquivo) return;
    if (!arquivo.type.startsWith('image/')) {
      erroLocalFoto = 'O arquivo precisa ser uma imagem (JPG, PNG ou WEBP).';
      e.currentTarget.value = '';
    } else if (arquivo.size > data.fotoMaximoMb * 1024 * 1024) {
      erroLocalFoto = `A foto tem ${(arquivo.size / 1048576).toFixed(1).replace('.', ',')} MB; o máximo é ${data.fotoMaximoMb} MB.`;
      e.currentTarget.value = '';
    }
  }
</script>

<svelte:head>
  <title>Minha conta — Calper</title>
</svelte:head>

<div class="p-5 md:p-8 max-w-2xl">
  <h1 class="text-xl font-bold text-calper-dark">Minha conta</h1>
  <p class="text-sm text-gray-500 mt-0.5 mb-6">{data.conta.nome} · {data.conta.email} · perfil {data.conta.rotuloPerfil}</p>

  <!-- foto de perfil -->
  <section class="card p-6 mb-5">
    <h2 class="text-base font-bold text-calper-dark mb-4">Foto de perfil</h2>
    <div class="flex items-center gap-5 flex-wrap">
      <AvatarEquipe id={data.conta.id} nome={data.conta.nome} fotoVersao={data.conta.fotoVersao} classe="w-20 h-20 text-2xl" />
      <form
        method="POST"
        action="?/enviarFoto"
        enctype="multipart/form-data"
        use:enhance={() => {
          enviandoFoto = true;
          return async ({ result, update }) => {
            await update({ reset: result.type === 'success' });
            enviandoFoto = false;
            // a foto nova só aparece com o número de versão novo: recarrega os dados do layout (só se deu certo,
            // pra não apagar a mensagem de erro)
            if (result.type === 'success') location.reload();
          };
        }}
        class="flex flex-col gap-2 flex-1 min-w-[16rem]"
      >
        <input name="foto" type="file" accept="image/jpeg,image/png,image/webp" class="input" onchange={aoEscolherFoto} required />
        <p class="text-xs text-gray-400">JPG, PNG ou WEBP, até {data.fotoMaximoMb} MB.</p>
        {#if erroLocalFoto}<AvisoSutil>{erroLocalFoto}</AvisoSutil>{/if}
        {#if form?.erroFoto}<AvisoSutil>{form.erroFoto}</AvisoSutil>{/if}
        {#if form?.sucessoFoto}<p class="text-sm text-green-700">{form.sucessoFoto}</p>{/if}
        <div class="flex gap-3 items-center">
          <div class="w-40"><SubmitButton loading={enviandoFoto} class="!py-2.5 text-sm">Enviar foto</SubmitButton></div>
        </div>
      </form>
    </div>
    {#if data.conta.fotoVersao}
      <form method="POST" action="?/removerFoto" use:enhance={() => async ({ result, update }) => { await update(); if (result.type === 'success') location.reload(); }} class="mt-3">
        <button type="submit" class="text-xs font-semibold text-gray-500 hover:text-calper-red">Remover foto</button>
      </form>
    {/if}
  </section>

  <!-- troca de senha -->
  <section class="card p-6">
    <h2 class="text-base font-bold text-calper-dark mb-4">Trocar senha</h2>
    {#if form?.erroSenha}<div class="mb-3"><AvisoSutil>{form.erroSenha}</AvisoSutil></div>{/if}
    {#if form?.sucesso}
      <div class="bg-green-50 border border-green-100 text-green-700 text-sm rounded-xl px-4 py-3 mb-3">{form.sucesso}</div>
    {/if}
    <form
      method="POST"
      action="?/trocarSenha"
      use:enhance={() => {
        trocando = true;
        return async ({ update }) => {
          await update({ reset: true });
          novaSenha = '';
          trocando = false;
        };
      }}
      class="flex flex-col gap-4"
    >
      <div>
        <label for="senhaAtual" class="block text-sm font-semibold text-calper-dark mb-1.5">Senha atual</label>
        <input id="senhaAtual" name="senhaAtual" type="password" autocomplete="current-password" class="input" required />
      </div>
      <div>
        <label for="novaSenha" class="block text-sm font-semibold text-calper-dark mb-1.5">Nova senha</label>
        <input id="novaSenha" name="novaSenha" type="password" autocomplete="new-password" class="input" bind:value={novaSenha} required />
        <div class="mt-2"><PasswordStrength senha={novaSenha} /></div>
      </div>
      <div>
        <label for="confirmarSenha" class="block text-sm font-semibold text-calper-dark mb-1.5">Repita a nova senha</label>
        <input id="confirmarSenha" name="confirmarSenha" type="password" autocomplete="new-password" class="input" required />
      </div>
      <div class="sm:w-56"><SubmitButton loading={trocando}>Trocar senha</SubmitButton></div>
    </form>
  </section>
</div>
