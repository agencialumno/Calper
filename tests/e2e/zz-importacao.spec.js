import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { comBanco } from './db.js';
import { entrarComoAdmin } from './helpers.js';

const PLANILHA = path.join(path.dirname(fileURLToPath(import.meta.url)), '../fixtures/base-teste.xlsx');

async function gerarPrevia(page) {
  await page.goto('/admin/unidades/importar', { waitUntil: 'networkidle' });
  await page.setInputFiles('#arquivo', PLANILHA);
  await page.click('button:has-text("Gerar prévia")');
  await expect(page.getByText('O que fazer com essa planilha?')).toBeVisible();
}

const numeroNo = (page, rotulo) => page.locator('div.rounded-2xl', { hasText: rotulo }).locator('.text-2xl').first();

test.describe('importação da base (prévia, atualizar e sobrescrever)', () => {
  test.beforeEach(async ({ page }) => {
    await entrarComoAdmin(page);
  });

  test('a prévia mostra o que muda e NÃO grava nada', async ({ page }) => {
    const antes = await comBanco((db) => db.unidade.count());
    await gerarPrevia(page);

    await expect(numeroNo(page, 'Na planilha')).toHaveText('7');
    await expect(numeroNo(page, 'Novas')).toHaveText('2');
    await expect(numeroNo(page, 'A atualizar')).toHaveText('5');
    await expect(numeroNo(page, 'Fora da planilha')).toHaveText('2');
    // unidades com agendamento/documento aparecem em destaque
    // (os testes de agendamento público acima podem ter criado outros: confere ao menos as 3 do cenário base)
    await expect(page.getByText(/unidade\(s\) a atualizar já têm agendamento ou documento/)).toBeVisible();
    for (const n of ['101', '102', '103']) await expect(page.getByText(`Bloco 2 - nº ${n}`).first()).toBeVisible();
    // estoque e jurídico não aparecem no agendamento público
    await expect(page.getByText('2 unidade(s) não aparecerão no agendamento público')).toBeVisible();
    // co-comprador cadastrado que nao esta na planilha (que lista so o principal): aviso
    await expect(page.getByText(/compradores cadastrados/).first()).toBeVisible();
    // coluna GRUPO ausente: aviso
    await expect(page.getByText(/não tem a coluna GRUPO/)).toBeVisible();
    // detalhe de cada unidade (a lista já vem aberta quando são poucas)
    await expect(page.getByText('Status-Quitação: Saldo quitado → A vencer')).toBeVisible();
    await page.screenshot({ path: process.env.PREVIA_PNG ?? 'test-results/previa-importacao.png', fullPage: true });

    expect(await comBanco((db) => db.unidade.count())).toBe(antes);
    expect(await comBanco((db) => db.unidade.count({ where: { numero: { in: ['101', '102', '103', '104', '105'] }, vistoriaStatus: { not: null } } }))).toBe(0);
  });

  test('"Sobrescrever" exige confirmação e perfil admin; sem isso nada é apagado', async ({ page }) => {
    await gerarPrevia(page);
    await page.check('input[name=modo][value=sobrescrever]');
    await expect(page.getByText('Isto vai APAGAR, de forma definitiva:')).toBeVisible();
    const aplicar = page.getByRole('button', { name: 'Apagar tudo e importar do zero' });
    await expect(aplicar).toBeDisabled();
    await page.check('input[name=entendi]');
    await page.fill('#confirmacao', 'sobrescrever errado');
    await expect(aplicar).toBeDisabled();
    expect(await comBanco((db) => db.agendamento.count())).toBeGreaterThan(0);
  });

  test('Atualizar: cria as novas, altera só o que mudou e não toca em agendamentos, documentos nem histórico', async ({ page }) => {
    const antes = await comBanco(async (db) => ({
      agendamentos: await db.agendamento.count(),
      documentos: await db.documentoAssinado.count(),
      investidores: await db.investidor.count(),
      u106: await db.unidade.findFirst({ where: { numero: '106' }, select: { id: true } })
    }));

    await gerarPrevia(page);
    await page.check('input[name=modo][value=atualizar]');
    await page.click('button:has-text("Aplicar atualização")');
    await expect(page.getByText('Base atualizada com')).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: 'unidade(s) criada(s)' })).toContainText('2');

    await comBanco(async (db) => {
      // nada apagado
      expect(await db.agendamento.count()).toBe(antes.agendamentos);
      expect(await db.documentoAssinado.count()).toBe(antes.documentos);
      expect(await db.investidor.count()).toBe(antes.investidores);
      expect(await db.unidade.findFirst({ where: { numero: '106' } })).not.toBeNull(); // ausente da planilha: continua
      // novas e atualizadas
      expect(await db.unidade.count({ where: { numero: { in: ['201', '202'] } } })).toBe(2);
      const u101 = await db.unidade.findFirst({ where: { numero: '101' } });
      expect(u101).toMatchObject({ tipologia: '3 QUARTOS', statusQuitacao: 'a_vencer', escritura: 'ESCRITURA PÚBLICA ASSINADA', vistoriaStatus: 'APROVADA', vistoriaAprovada: true });
      const u102 = await db.unidade.findFirst({ where: { numero: '102' } });
      expect(u102).toMatchObject({ vistoriaStatus: 'LIBERADA PARA AGENDAMENTO - VISTORIA', vistoriaAprovada: false });
      // célula em branco (N/A) não apagou o comprador existente
      const u104 = await db.unidade.findFirst({ where: { numero: '104' } });
      expect(u104.compradores).toEqual([{ nome: 'COMPRADOR QUATRO TESTE', principal: true }]);
      expect(u104.vistoriaStatus).toBe('EM ESTOQUE');
      // o co-comprador que nao esta na planilha foi MANTIDO (a planilha lista so um comprador por unidade)
      const u105 = await db.unidade.findFirst({ where: { numero: '105' } });
      expect(u105.compradores.map((c) => c.nome)).toEqual(['COMPRADOR CINCO TESTE', 'CO-COMPRADOR CINCO TESTE']);
      const u201 = await db.unidade.findFirst({ where: { numero: '201' } });
      expect(u201.compradores).toHaveLength(2);
      // o que mudou ficou no histórico
      expect(await db.historicoUnidade.count({ where: { unidadeId: u101.id, descricao: { contains: 'Atualizada pela importação' } } })).toBe(1);
    });

    // segunda importação da mesma planilha: nada a fazer
    await gerarPrevia(page);
    await expect(numeroNo(page, 'A atualizar')).toHaveText('0');
    await expect(numeroNo(page, 'Novas')).toHaveText('0');
  });

  test('agendamento público: estoque, jurídico e sem comprador não aparecem; as novas aparecem', async ({ page }) => {
    await page.goto('/agendar-entrega-chaves', { waitUntil: 'networkidle' });
    const opcoes = (await page.locator('#unidadeId option').allTextContents()).join('|');
    expect(opcoes).not.toContain('nº 104'); // EM ESTOQUE
    expect(opcoes).not.toContain('nº 201'); // JURÍDICO
    expect(opcoes).toContain('nº 202'); // nova e aprovada
  });

  test('Sobrescrever: reseta unidades, agendamentos e investidores; preserva equipe, modelos e agenda', async ({ page }) => {
    const antes = await comBanco(async (db) => ({
      funcionarios: await db.funcionario.count(),
      sessoes: await db.sessaoFuncionario.count(),
      dias: await db.agendaDia.count(),
      template: await db.documentoTemplate.findFirst({ where: { tipo: 'termo_entrega_chaves' } })
    }));
    expect(antes.template.conteudo).toBe('TEXTO DO TERMO EDITADO PELA EQUIPE');

    await gerarPrevia(page);
    await page.check('input[name=modo][value=sobrescrever]');
    await page.check('input[name=entendi]');
    await page.fill('#confirmacao', 'SOBRESCREVER');
    await page.click('button:has-text("Apagar tudo e importar do zero")');
    await expect(page.getByText('Base sobrescrita com')).toBeVisible();

    await comBanco(async (db) => {
      expect(await db.unidade.count()).toBe(7);
      // sobrescrever importa SO o que esta na planilha: o co-comprador some (por isso a previa avisa)
      expect((await db.unidade.findFirst({ where: { numero: '105' } })).compradores).toHaveLength(1);
      expect(await db.agendamento.count()).toBe(0);
      expect(await db.documentoAssinado.count()).toBe(0);
      expect(await db.presencaEntrega.count()).toBe(0);
      expect(await db.investidor.count()).toBe(0);
      expect(await db.procuracaoUnidade.count()).toBe(0);
      // a equipe, as sessões, a agenda e os modelos de documento continuam
      expect(await db.funcionario.count()).toBe(antes.funcionarios);
      expect(await db.sessaoFuncionario.count()).toBeGreaterThanOrEqual(1);
      expect(await db.agendaDia.count()).toBe(antes.dias);
      const t = await db.documentoTemplate.findFirst({ where: { tipo: 'termo_entrega_chaves' } });
      expect(t.conteudo).toBe('TEXTO DO TERMO EDITADO PELA EQUIPE');
      expect(t.variaveis.numeroCertidao).toBe('99/9999/2030');
      // auditoria da importação
      expect(await db.logAcesso.count({ where: { acao: 'base_sobrescrita' } })).toBe(1);
      expect(await db.logAcesso.count({ where: { acao: 'base_atualizada' } })).toBe(1);
    });

    // o admin continua logado depois do reset
    await page.goto('/admin/unidades');
    await expect(page).toHaveURL(/\/admin\/unidades/);
  });
});
