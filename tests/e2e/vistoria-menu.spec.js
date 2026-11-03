import { expect, test } from '@playwright/test';
import { COLABORADOR, SUPERVISOR } from '../preparar-banco-teste.js';
import { comBanco } from './db.js';
import { entrarComoAdmin } from './helpers.js';

// Menu da equipe: item "Vistoria" abaixo de "Chaves", página /admin/vistoria, item ativo e sidebar sem scroll.
// Só lê dados; roda SÓ no banco de teste (schema calper_test).
const menuDesktop = (page) => page.locator('aside nav');

test.describe('menu: Vistoria', () => {
  test('admin: "Vistoria" vem logo abaixo de "Chaves" e só ele fica ativo na página', async ({ page }) => {
    test.setTimeout(240_000); // a primeira visita compila as rotas novas do servidor de desenvolvimento
    await page.setViewportSize({ width: 1366, height: 768 });
    await entrarComoAdmin(page);
    await page.goto('/admin/vistoria', { waitUntil: 'networkidle' });
    const itens = (await menuDesktop(page).locator('a').allTextContents()).map((t) => t.trim());
    expect(itens[itens.indexOf('Chaves') + 1]).toBe('Vistoria');
    const ativos = await menuDesktop(page).locator('a.bg-white').allTextContents();
    expect(ativos.map((t) => t.trim())).toEqual(['Vistoria']);
    await page.goto('/admin/agenda-vistoria', { waitUntil: 'networkidle' });
    expect((await menuDesktop(page).locator('a.bg-white').allTextContents()).map((t) => t.trim())).toEqual(['Agenda vistoria']);
  });

  test('sidebar desktop 1366x768 sem scroll: todos os itens, logo e "Sair" visíveis', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await entrarComoAdmin(page);
    await page.goto('/admin/vistoria', { waitUntil: 'networkidle' });
    const nav = menuDesktop(page);
    const medidas = await nav.evaluate((n) => ({ rolagem: n.scrollHeight - n.clientHeight }));
    expect(medidas.rolagem).toBeLessThanOrEqual(0);
    await expect(page.locator('aside img[alt="Calper"]')).toBeInViewport();
    await expect(page.locator('aside').getByRole('button', { name: 'Sair' })).toBeInViewport();
    await expect(nav.getByRole('link', { name: 'Logs' })).toBeInViewport();
  });

  test('página lista as vistorias ou mostra "Sem agendamentos"', async ({ page }) => {
    await entrarComoAdmin(page);
    await page.goto('/admin/vistoria', { waitUntil: 'networkidle' });
    const total = await comBanco((db) => db.agendamento.count({ where: { tipoEvento: { slug: 'vistoria' } } }));
    if (total === 0) await expect(page.getByTestId('sem-agendamentos')).toHaveText('Sem agendamentos');
    else await expect(page.getByTestId('card-vistoria').first()).toBeVisible();
  });

  test('supervisor e colaborador veem "Vistoria" no menu; a aba Chaves segue como antes', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    for (const conta of [SUPERVISOR, COLABORADOR]) {
      await page.context().clearCookies();
      await entrarComoAdmin(page, conta);
      await page.goto('/admin/vistoria', { waitUntil: 'networkidle' });
      await expect(menuDesktop(page).getByRole('link', { name: 'Vistoria', exact: true })).toBeVisible();
      await expect(menuDesktop(page).getByRole('link', { name: 'Chaves', exact: true })).toBeVisible();
    }
  });

  test('mobile 375px: todos os itens acessíveis, sem rolagem lateral e item ativo correto', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await entrarComoAdmin(page);
    await page.goto('/admin/vistoria', { waitUntil: 'networkidle' });
    const barra = page.locator('nav[class~="md:hidden"]');
    for (const nome of ['Dashboard', 'Unidades', 'Agenda', 'Agenda vistoria', 'Chaves', 'Vistoria', 'Logs']) {
      await expect(barra.getByRole('link', { name: nome, exact: true })).toBeVisible();
    }
    expect((await barra.locator('a.bg-calper-red').allTextContents()).map((t) => t.trim())).toEqual(['Vistoria']);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
});
