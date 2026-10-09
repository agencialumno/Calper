import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    sveltekit(),
    SvelteKitPWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js', // build do src/service-worker.js
      registerType: 'autoUpdate',
      injectRegister: false,
      // O service worker é registrado em src/hooks.client.js.
      manifestFilename: 'manifest.webmanifest',
      manifest: {
        id: '/painel',
        name: 'Calper — Plataforma do Investidor',
        short_name: 'Calper',
        description: 'Plataforma do Investidor Calper',
        lang: 'pt-BR',
        start_url: '/painel',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#282e35',
        background_color: '#282e35',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      injectManifest: {
        // Só assets estáticos entram no precache — nunca HTML de rota, exceto /offline.html.
        globPatterns: ['client/**/*.{js,css,woff,woff2}', 'client/offline.html', 'client/icons/*.png', 'client/logo*.png', 'client/favicon.png'],
        globIgnores: ['**/*.map']
      },
      kit: {}
    })
  ]
});
