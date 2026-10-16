<script>
  import '../app.css';
  import LoadingOverlay from '$lib/components/LoadingOverlay.svelte';
  import UploadGuard from '$lib/components/UploadGuard.svelte';
  let { children } = $props();
</script>

<LoadingOverlay />
<UploadGuard />
{@render children()}
