import { expect, test } from '@playwright/test';
import { baixar, entrarComoAdmin } from './helpers.js';

const linhasCsv = (corpo) =>
  corpo
    .toString('utf8')
    .replace(/^﻿/, '')
    .split('\r\n')
    .filter(Boolean)
    .map((l) => l.split(';').map((c) => c.replace(/^"|"$/g, '')));

test.describe('gestão: quem agendou, presença, CSVs e zip', () => {
  test.beforeEach(async ({ page }) => {
    await entrarComoAdmin(page);
  });

  test('lista "quem agendou" e exporta o CSV com os mesmos filtros', async ({ page }) => {
    await page.goto('/admin/quem-agendou', { waitUntil: 'networkidle' });
    await expect(page.getByText('Pessoa Concluida')).toBeVisible();
    await expect(page.getByText('Pessoa Compareceu')).toBeVisible();
    await expect(page.getByText('procuração anexada').first()).toBeVisible();

    const todos = await baixar(page, '/admin/quem-agendou/exportar');
    expect(todos.status).toBe(200);
    expect(todos.tipo).toContain('text/csv');
    const linhas = linhasCsv(todos.corpo);
    expect(linhas[0]).toContain('Nome');
    expect(linhas[0]).toContain('CPF');
    expect(linhas[0]).toContain('Procuração anexada');
    // os 3 agendamentos de base (outros testes podem ter criado mais pelo formulário público)
    const nomes = linhas.slice(1).map((l) => l[1]);
    for (const n of ['Pessoa Concluida', 'Pessoa Compareceu', 'Pessoa Faltou']) expect(nomes).toContain(n);

    const filtrado = linhasCsv((await baixar(page, '/admin/quem-agendou/exportar?status=realizado')).corpo);
    expect(filtrado.length - 1).toBe(1);
    expect(filtrado[1][1]).toBe('Pessoa Concluida');
    expect(filtrado[1][2]).toBe('529.982.247-25');
  });

  test('presença separa quem já recebeu a chave de quem ainda não recebeu', async ({ page }) => {
    await page.goto('/admin/presenca', { waitUntil: 'networkidle' });
    await expect(page.getByText('agendaram e ainda não receberam a chave')).toBeVisible();
    const faltam = page.locator('#faltam');
    await expect(faltam).toContainText('Pessoa Compareceu');
    await expect(faltam).toContainText('compareceu — entrega não concluída');
    await expect(faltam).toContainText('Pessoa Faltou');
    await expect(faltam).toContainText('não compareceu');
    await expect(faltam).not.toContainText('Pessoa Concluida');
    await expect(page.locator('#receberam')).toContainText('Pessoa Concluida');
  });

  test('CSV recebeu x ainda não recebeu traz os dois grupos', async ({ page }) => {
    const r = await baixar(page, '/admin/presenca/exportar-entregas');
    expect(r.status).toBe(200);
    const linhas = linhasCsv(r.corpo);
    const situacoes = linhas.slice(1).map((l) => l[0]);
    expect(situacoes.filter((s) => s === 'Recebeu a chave')).toHaveLength(1);
    expect(linhas.filter((l) => l[0] === 'Ainda não recebeu').map((l) => l[3])).toEqual(expect.arrayContaining(['Pessoa Compareceu', 'Pessoa Faltou']));
    expect(linhas.filter((l) => l[0] === 'Ainda não recebeu').map((l) => l[3])).not.toContain('Pessoa Concluida');
    const recebeu = linhas.find((l) => l[0] === 'Recebeu a chave');
    expect(recebeu[3]).toBe('Pessoa Concluida');
    expect(recebeu[13]).not.toBe(''); // data da entrega
  });

  test('exportações já existentes continuam funcionando (dashboard e lista de presença)', async ({ page }) => {
    for (const caminho of ['/admin/dashboard/exportar', '/admin/presenca/exportar']) {
      const r = await baixar(page, caminho);
      expect(r.status, caminho).toBe(200);
      expect(r.tipo, caminho).toContain('text/csv');
    }
  });

  test('backup por unidade: .zip com procuração e índice', async ({ page }) => {
    await page.goto('/admin/unidades', { waitUntil: 'networkidle' });
    const link = await page.locator('a[href^="/admin/unidades/"]').first().getAttribute('href');
    const ids = await page.evaluate(async () => {
      const html = await (await fetch('/admin/unidades')).text();
      return [...html.matchAll(/\/admin\/unidades\/([a-z0-9]{20,})/g)].map((m) => m[1]);
    });
    expect(link).toBeTruthy();
    let achou = false;
    for (const id of [...new Set(ids)]) {
      const r = await baixar(page, `/admin/unidades/${id}/arquivos`);
      expect(r.status).toBe(200);
      expect(r.tipo).toBe('application/zip');
      expect(r.corpo.subarray(0, 2).toString()).toBe('PK');
      if (r.corpo.includes(Buffer.from('procuracoes/'))) achou = true;
    }
    expect(achou).toBe(true);
  });
});

test.describe('fluxo do atendimento (passo 2)', () => {
  test('foto da procuração vira PDF antes de enviar', async ({ page }) => {
    await entrarComoAdmin(page);
    await page.goto('/admin/quem-agendou', { waitUntil: 'networkidle' });
    await page.locator('a', { hasText: 'Bloco 2 - nº 103' }).first().click();
    await page.waitForURL(/entrega-chaves\//);
    await page.goto(page.url().split('?')[0] + '?passo=2', { waitUntil: 'networkidle' });
    await page.check('input[name=quem][value=outro]');
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    await page.setInputFiles('input[data-converte-antes]', { name: 'foto.png', mimeType: 'image/png', buffer: png });
    await expect(page.getByText(/1 foto\(s\) → PDF de 1 página\(s\)/)).toBeVisible();
  });
});
