import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter(),
    // SW é registrado manualmente em src/hooks.client.js (vite-pwa renomeia para /sw.js)
    serviceWorker: { register: false }
  }
};

export default config;
