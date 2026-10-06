<script>
  import { slide } from 'svelte/transition';

  let { children } = $props();
</script>

<div
  class="flex items-start gap-2.5 bg-[#fdeceb] border border-[#f5c9cb] rounded-xl px-3.5 py-3 text-xs text-[#8a1016] leading-relaxed"
  transition:slide={{ duration: 200 }}
>
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.2"
    class="shrink-0 mt-0.5"
  >
    <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
  </svg>
  <span>{@render children?.()}</span>
</div>
