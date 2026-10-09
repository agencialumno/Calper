// Registra o service worker (PWA) apenas em produção; o site funciona igual sem ele.
if (!import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
}
