<script>
  /** @type {{ href: string, label?: string }} */
  let { href, label = 'Voltar' } = $props();
</script>

<a
  {href}
  class="inline-flex items-center gap-1.5 -ml-1.5 px-3.5 py-2.5 rounded-full text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 hover:text-calper-dark active:scale-95 transition-all"
>
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
    <path d="M15 18l-6-6 6-6" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
  {label}
</a>