<script>
  import DocumentoEditor from '$lib/components/DocumentoEditor.svelte';

  let { data, form } = $props();
</script>

<svelte:head>
  <title>Checklist de entrega — Calper</title>
</svelte:head>

<DocumentoEditor
  titulo="Checklist — entrega de chaves"
  texto={data.texto}
  unidadeId={data.unidadeId}
  tipo="checklist"
  rotuloUnidade={data.rotuloUnidade}
  voltarHref="/admin/unidades/{data.unidadeId}"
  assinatura={data.assinatura}
  aviso={data.aviso}
  erro={form?.erro}
/>
