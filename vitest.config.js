import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { pdfBase64 } from './vite-pdf-base64.js';

// Testes de unidade (rápidos, sem banco e sem navegador): funções puras do servidor e das regras de negócio.
export default defineConfig({
  plugins: [pdfBase64()],
  resolve: {
    alias: {
      $lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
      // fora do SvelteKit não existe $env: o stub devolve process.env
      '$env/dynamic/private': fileURLToPath(new URL('./tests/stubs/env-dynamic-private.js', import.meta.url))
    }
  },
  test: { include: ['tests/unit/**/*.test.js'], environment: 'node' }
});
