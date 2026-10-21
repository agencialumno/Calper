import { expect, test } from '@playwright/test';
import { ATENDIMENTO } from '../preparar-banco-teste.js';
import { entrarComoAdmin } from './helpers.js';

test.describe('guarda da área da equipe', () => {
  test('sem login, páginas redirecionam e ações/endpoints são bloqueados', async ({ request }) => {
    for (const caminho of ['/admin/dashboard', '/admin/presenca/exportar', '/admin/quem-agendou/exportar', '/admin/presenca/exportar-entregas']) {
      const r = await request.get(caminho, { maxRedirects: 0 });
      expect(r.status(), caminho).toBe(303);
      expect(r.headers().location).toContain('/admin/login');
    }
    for (const acao of ['/admin/documentos?/salvarTexto', '/admin/unidades/importar?/confirmar', '/admin/agenda?/salvarPadrao']) {
      const r = await request.post(acao, { form: { a: '1' }, headers: { 'x-sveltekit-action': 'true', origin: 'http://localhost:5301' } });
      expect(r.status(), acao).toBe(401);
    }
  });

  test('o atendimento entra no check-in mas não nas áreas de gestão', async ({ page }) => {
    await entrarComoAdmin(page, ATENDIMENTO);
    await page.goto('/admin/checkin');
    await expect(page).toHaveURL(/\/admin\/checkin/);
    const r = await page.request.get('/admin/presenca/exportar', { maxRedirects: 0 });
    expect(r.status()).toBe(303);
    expect(r.headers().location).toContain('/admin/sem-acesso');
  });
});

test.describe('cadastro da equipe', () => {
  test('cria a conta com senha forte e já entra no painel', async ({ page }) => {
    await page.goto('/admin/cadastro', { waitUntil: 'networkidle' });
    await page.fill('#nome', 'Pessoa Nova Teste');
    await page.fill('#email', 'pessoa.nova@example.com');
    await page.fill('#senha', 'Forte@Teste2030');
    await page.fill('#confirmarSenha', 'Forte@Teste2030');
    await Promise.all([page.waitForURL((u) => !u.pathname.endsWith('/cadastro')), page.click('button[type=submit]')]);
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/admin\/dashboard/);
  });

  test('senha fraca é recusada', async ({ page }) => {
    await page.goto('/admin/cadastro', { waitUntil: 'networkidle' });
    await page.fill('#nome', 'Pessoa Fraca Teste');
    await page.fill('#email', 'pessoa.fraca@example.com');
    await page.fill('#senha', 'abc12345');
    await page.fill('#confirmarSenha', 'abc12345');
    await page.click('button[type=submit]');
    await expect(page.getByText(/nível "forte"|forte/i).first()).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/cadastro/);
  });
});
