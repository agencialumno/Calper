import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { COLABORADOR } from '../preparar-banco-teste.js';
import { comBanco } from './db.js';
import { entrarComoAdmin } from './helpers.js';

// A cor da etiqueta "Escritura" acompanha o status editado, na hora. Roda SÓ no banco de teste (schema calper_test).
const STATUS = [
  ['CESSÃO - ARREMATAÇÃO', 'vermelho'],
  ['PENDENTE ESCRITURA', 'laranja'],
  ['ESCRITURA PÚBLICA ASSINADA', 'verde'],
  ['PROMESSA DE COMPRA E VENDA', 'azul'],
  ['PROMESSA DE CESSÃO', 'ciano'],
  ['CESSÃO DE DIREITOS', 'roxo'],
  ['CESSÃO DE DIREITO (INDISPONIBILIDADE)', 'rosa']
];
const PASTA_PRINTS = process.env.PRINTS_CORES ?? '';

test.describe('cores da etiqueta Escritura atual', () => {
  // devolve a unidade 106 ao que o banco de teste tinha: as outras specs contam com esses dados
  let original;
  test.beforeAll(async () => {
    original = (await comBanco((db) => db.unidade.findFirst({ where: { numero: '106' } }))).escrituraAtual;
  });
  test.afterAll(async () => {
    await comBanco((db) => db.unidade.updateMany({ where: { numero: '106' }, data: { escrituraAtual: original } }));
  });

  test('editar o status muda a cor na hora (aba Unidades), sem recarregar a página', async ({ page }) => {
    await entrarComoAdmin(page);
    await page.goto('/admin/unidades', { waitUntil: 'networkidle' });
    const cartao = page.locator('li', { hasText: '106' }).first();
    const tag = cartao.getByTestId('tag-escritura');
    await page.evaluate(() => (window.__semRecarga = 'mesma-pagina'));

    for (const [status, cor] of STATUS) {
      await cartao.getByRole('button', { name: 'editar status' }).click();
      await cartao.getByLabel('Escritura atual').selectOption({ label: status.charAt(0) + status.slice(1).toLowerCase() });
      await cartao.getByRole('button', { name: 'Salvar' }).click();
      await expect(tag).toHaveAttribute('data-cor', cor); // a cor mudou
      await expect(tag).toContainText(status.charAt(0) + status.slice(1).toLowerCase()); // o texto continua dentro da etiqueta
      expect((await comBanco((db) => db.unidade.findFirst({ where: { numero: '106' } }))).escrituraAtual).toBe(status);
      if (PASTA_PRINTS) {
        fs.mkdirSync(PASTA_PRINTS, { recursive: true });
        await tag.screenshot({ path: `${PASTA_PRINTS}/${cor}.png` });
      }
    }
    expect(await page.evaluate(() => window.__semRecarga)).toBe('mesma-pagina'); // nada de F5
  });

  test('mesma cor na aba Chaves, no dossiê e no passo 1 do atendimento', async ({ page }) => {
    await entrarComoAdmin(page);
    const u = await comBanco(async (db) => {
      const unidade = await db.unidade.findFirst({ where: { numero: '106' } });
      await db.unidade.update({ where: { id: unidade.id }, data: { escrituraAtual: 'PENDENTE ESCRITURA' } });
      const tipo = await db.tipoEvento.findUnique({ where: { slug: 'entrega-chaves' } });
      const inv = await db.investidor.findFirst();
      const ag = await db.agendamento.findFirst({ where: { unidadeId: unidade.id } }) ?? await db.agendamento.create({ data: { unidadeId: unidade.id, tipoEventoId: tipo.id, investidorId: inv.id, dataHora: new Date('2030-10-28T09:00:00Z'), qrToken: 'qr-cores-escritura', nomeCompareceu: 'Cores Escritura' } });
      return { unidade, ag };
    });
    for (const [rotulo, caminho] of [
      ['aba Chaves', '/admin/entrega-chaves'],
      ['dossiê', `/admin/unidades/${u.unidade.id}`],
      ['passo 1 do atendimento', `/admin/entrega-chaves/${u.ag.id}?passo=1`]
    ]) {
      await page.goto(caminho, { waitUntil: 'networkidle' });
      const tag = page.getByTestId('tag-escritura').first();
      await expect(tag, rotulo).toHaveAttribute('data-cor', 'laranja');
      await expect(tag, rotulo).toContainText('Pendente escritura');
    }
  });

  test('a edição pelo cartão na aba Chaves também muda a cor na hora', async ({ page }) => {
    await entrarComoAdmin(page);
    await page.goto('/admin/entrega-chaves', { waitUntil: 'networkidle' });
    const cartao = page.locator('.card', { hasText: 'Bloco 2 - nº 106' }).first();
    await cartao.getByRole('button', { name: 'editar status' }).click();
    await cartao.getByLabel('Escritura atual').selectOption({ label: 'Promessa de cessão' });
    await cartao.getByRole('button', { name: 'Salvar' }).click();
    await expect(cartao.getByTestId('tag-escritura')).toHaveAttribute('data-cor', 'ciano');
  });

  test('valor fora do mapa (grafia diferente da planilha) cai no cinza, sem quebrar a tela', async ({ page }) => {
    await comBanco((db) => db.unidade.updateMany({ where: { numero: '106' }, data: { escrituraAtual: 'EM ANÁLISE JURÍDICA (NOVO STATUS)' } }));
    await entrarComoAdmin(page);
    await page.goto('/admin/unidades', { waitUntil: 'networkidle' });
    const tag = page.locator('li', { hasText: '106' }).first().getByTestId('tag-escritura');
    await expect(tag).toHaveAttribute('data-cor', 'cinza');
    await expect(tag).toContainText('Em análise jurídica (novo status)');
  });

  test('o colaborador vê a cor, mas não edita (permissão inalterada)', async ({ page }) => {
    await comBanco((db) => db.unidade.updateMany({ where: { numero: '106' }, data: { escrituraAtual: 'CESSÃO DE DIREITOS' } }));
    await entrarComoAdmin(page, COLABORADOR);
    await page.goto('/admin/unidades', { waitUntil: 'networkidle' });
    const cartao = page.locator('li', { hasText: '106' }).first();
    await expect(cartao.getByTestId('tag-escritura')).toHaveAttribute('data-cor', 'roxo');
    await expect(cartao.getByRole('button', { name: 'editar status' })).toHaveCount(0);
  });
});
