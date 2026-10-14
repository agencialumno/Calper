<script>
  import DocumentoEditor from '$lib/components/DocumentoEditor.svelte';

  let { data, form } = $props();
</script>

<svelte:head>
  <title>Termo de entrega de chaves — Calper</title>
</svelte:head>

<DocumentoEditor
  titulo="Termo de entrega de chaves"
  texto={data.texto}
  unidadeId={data.unidadeId}
  tipo="termo"
  rotuloUnidade={data.rotuloUnidade}
  voltarHref="/admin/unidades/{data.unidadeId}"
  assinatura={data.assinatura}
  aviso={data.aviso}
  erro={form?.erro}
/>
