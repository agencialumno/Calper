<script>
  import '../app.css';
  import LoadingOverlay from '$lib/components/LoadingOverlay.svelte';
  let { children } = $props();
</script>

<LoadingOverlay />
{@render children()}
