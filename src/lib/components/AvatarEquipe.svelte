<script>
  // Avatar da equipe: foto de perfil (quando enviada) ou as iniciais do nome.
  let { id, nome, fotoVersao = null, classe = 'w-8 h-8 text-xs' } = $props();
  let falhou = $state(false);
</script>

{#if fotoVersao && !falhou}
  <img
    src="/admin/foto/{id}?v={fotoVersao}"
    alt={nome}
    class="rounded-full object-cover shrink-0 {classe}"
    onerror={() => (falhou = true)}
  />
{:else}
  <div class="rounded-full bg-calper-red text-white flex items-center justify-center font-bold shrink-0 {classe}">
    {nome.slice(0, 2).toUpperCase()}
  </div>
{/if}
