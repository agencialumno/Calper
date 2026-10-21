import { defineConfig } from '@playwright/test';
import { urlDoBancoDeTeste } from './tests/preparar-banco-teste.js';

// Testes de ponta a ponta: sobem o app (vite dev) apontando para o BANCO DE TESTE (schema calper_test) e rodam no
// Chrome do computador. O banco é recriado a cada execução (globalSetup). Nunca toca o banco de produção.
const PORTA = 5301;

export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './tests/e2e/global-setup.js',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  // o servidor de desenvolvimento compila cada rota na primeira visita: dá folga às verificações
  expect: { timeout: 30_000 },
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORTA}`, channel: 'chrome', headless: true, locale: 'pt-BR', trace: 'retain-on-failure' },
  webServer: {
    command: `npx vite dev --port ${PORTA} --strictPort`,
    url: `http://localhost:${PORTA}/admin/login`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: urlDoBancoDeTeste(),
      // nada de DocuSign nos testes desta fase: as variáveis ficam vazias de propósito
      DOCUSIGN_INTEGRATION_KEY: '',
      DOCUSIGN_RSA_PRIVATE_KEY: ''
    }
  }
});
