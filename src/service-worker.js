// Service worker do PWA. Política: só assets estáticos versionados (build) e a
// tela de "sem conexão" ficam em cache. Navegações e chamadas de dados (SSR,
// /api, forms, sessão) SEMPRE vão à rede — nunca servimos conteúdo dinâmico
// guardado, para não expor dado desatualizado ou de outro usuário.
import { cleanupOutdatedCaches, precacheAndRoute, matchPrecache } from 'workbox-precaching';

self.skipWaiting();
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Navegação: rede direta (sem cache). Se falhar (offline), mostra a página leve.
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(
    fetch(event.request).catch(async () => (await matchPrecache('/offline.html')) ?? Response.error())
  );
});
