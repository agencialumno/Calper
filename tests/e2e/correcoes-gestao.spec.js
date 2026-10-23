import { expect, test } from '@playwright/test';
import { comBanco } from './db.js';
import { entrarComoAdmin } from './helpers.js';

test.describe('correções: download, "Ver documentos" e painel de notificações', () => {
  test.beforeEach(async ({ page }) => {
    await entrarComoAdmin(page);
  });

  test('"Ver documentos" de uma entrega concluída abre o resumo com os PDFs, sem reabrir o fluxo', async ({ page }) => {
    await page.goto('/admin/entrega-chaves', { waitUntil: 'networkidle' });
    const cartao = page.locator('div', { hasText: 'Bloco 2 - nº 101' }).filter({ has: page.locator('a:has-text("Ver documentos")') }).last();
    await cartao.locator('a:has-text("Ver documentos")').first().click();
    await expect(page).toHaveURL(/passo=5/);
    await expect(page.getByText('Entrega concluída').first()).toBeVisible();
    await expect(page.getByText('Retirou as chaves')).toBeVisible();
    await expect(page.getByText('Baixar PDF').first()).toBeVisible();
    // não mostra o passo 1 / formulário de quem retira
    await expect(page.getByText('Situação da unidade (somente consulta)')).toHaveCount(0);
  });

  test('abrir a entrega concluída direto (sem passo) também cai no resumo', async ({ page }) => {
    const id = await comBanco(async (db) => (await db.agendamento.findFirst({ where: { status: 'realizado' }, select: { id: true } })).id);
    await page.goto(`/admin/entrega-chaves/${id}`, { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/passo=5/);
  });

  test('download do termo assinado: o botão volta ao normal (sem loading preso) e o arquivo baixa', async ({ page }) => {
    const id = await comBanco(async (db) => (await db.agendamento.findFirst({ where: { status: 'realizado' }, select: { id: true } })).id);
    await page.goto(`/admin/entrega-chaves/${id}?passo=5`, { waitUntil: 'networkidle' });
    const botao = page.getByRole('link', { name: 'Baixar PDF' }).first();
    const [download] = await Promise.all([page.waitForEvent('download'), botao.click()]);
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
    await expect(botao).toContainText('Baixar PDF'); // saiu de "Baixando…"
    await expect(page.locator('[aria-label="Carregando"]')).toHaveCount(0); // sem o loading global preso
  });

  test('download que falha mostra mensagem e destrava o botão', async ({ page }) => {
    const id = await comBanco(async (db) => (await db.agendamento.findFirst({ where: { status: 'realizado' }, select: { id: true } })).id);
    await page.goto(`/admin/entrega-chaves/${id}?passo=5`, { waitUntil: 'networkidle' });
    await page.route('**/documento/completo', (r) => r.fulfill({ status: 500, body: 'erro' }));
    const botao = page.getByRole('link', { name: 'Baixar PDF' }).first();
    await botao.click();
    await expect(page.getByRole('alert')).toContainText(/indisponível|expirada/);
    await expect(botao).toContainText('Baixar PDF');
  });

  for (const tela of [
    { largura: 1280, altura: 720 },
    { largura: 1366, altura: 768 },
    { largura: 1920, altura: 1080 }
  ]) {
    test(`painel de notificações abre dentro da tela no desktop ${tela.largura}x${tela.altura}`, async ({ page }) => {
      await page.setViewportSize({ width: tela.largura, height: tela.altura });
      await page.goto('/admin/dashboard', { waitUntil: 'networkidle' });
      const sino = page.locator('button[aria-label="Notificações"]:visible').first();
      await sino.click();
      const painel = page.locator('[popover]:popover-open').first();
      await expect(painel).toBeVisible();
      const caixa = await painel.boundingBox();
      const botao = await sino.boundingBox();
      expect(caixa.x).toBeGreaterThanOrEqual(0);
      expect(caixa.x + caixa.width).toBeLessThanOrEqual(tela.largura);
      expect(caixa.y).toBeGreaterThanOrEqual(0);
      expect(caixa.y + caixa.height).toBeLessThanOrEqual(tela.altura);
      // alinhado ao sino: logo abaixo e cobrindo o botão na horizontal
      expect(caixa.y).toBeGreaterThanOrEqual(botao.y + botao.height);
      expect(caixa.x).toBeLessThanOrEqual(botao.x + botao.width);
      expect(caixa.x + caixa.width).toBeGreaterThanOrEqual(botao.x);
    });
  }
});
