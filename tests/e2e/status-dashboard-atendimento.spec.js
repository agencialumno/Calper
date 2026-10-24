import { expect, test } from '@playwright/test';
import { COLABORADOR } from '../preparar-banco-teste.js';
import { comBanco } from './db.js';
import { baixar, entrarComoAdmin } from './helpers.js';

const acao = { 'x-sveltekit-action': 'true', origin: 'http://localhost:5301' };
const idAgendamento = (nome) => comBanco(async (db) => (await db.agendamento.findFirst({ where: { nomeCompareceu: nome } })).id);

test.describe('aba Unidades', () => {
  test('busca pelo nome do comprador/proprietário, sem o tick verde, com "ver mais"', async ({ page }) => {
    await entrarComoAdmin(page);
    await page.goto('/admin/unidades', { waitUntil: 'networkidle' });

    // sem o ícone de tick ao lado do nome
    await expect(page.getByText('✓')).toHaveCount(0);

    // busca pelo nome do comprador vinculado à unidade
    await page.fill('input[type=search]', 'COMPRADOR TRES');
    await expect(page.locator('li', { hasText: '103' }).first()).toBeVisible();
    await expect(page.locator('li', { hasText: 'COMPRADOR UM TESTE' })).toHaveCount(0);
    // o co-comprador (segundo nome da unidade) também acha a unidade
    await page.fill('input[type=search]', 'co-comprador cinco');
    await expect(page.locator('li', { hasText: '105' }).first()).toBeVisible();
    await page.fill('input[type=search]', '');

    // etiquetas: tipologia, grupo, quitação, vistoria e escritura atual
    const cartao = page.locator('li', { hasText: '107' }).first();
    for (const texto of ['2 QUARTOS', 'Grupo A', 'Quitação: Saldo quitado', 'Vistoria: Aprovada', 'Escritura: Promessa de compra e venda']) {
      await expect(cartao.getByText(texto)).toBeVisible();
    }
    // "ver mais" mostra o restante da base
    await expect(cartao.getByText('Vencido pago')).toHaveCount(0);
    await cartao.getByRole('button', { name: 'ver mais' }).click();
    await expect(cartao.getByText('Vencido pago')).toBeVisible();
    await expect(cartao.getByText(/123\.456,78/)).toBeVisible();
    await expect(cartao.getByText('15/03/2024')).toBeVisible(); // data da venda, sem deslocar o dia pelo fuso
    await expect(cartao.getByText('Escritura a ser lavrada')).toBeVisible();
  });

  test('admin altera o status direto pelo cartão', async ({ page }) => {
    await entrarComoAdmin(page);
    await page.goto('/admin/unidades', { waitUntil: 'networkidle' });
    const cartao = page.locator('li', { hasText: '106' }).first();
    await cartao.getByRole('button', { name: 'editar status' }).click();
    await cartao.getByLabel('Status-Quitação').selectOption('a_vencer');
    await cartao.getByRole('button', { name: 'Salvar' }).click();
    await expect(cartao.getByText('Quitação: A vencer')).toBeVisible();
    const u = await comBanco((db) => db.unidade.findFirst({ where: { numero: '106' } }));
    expect(u.statusQuitacao).toBe('a_vencer');
    // auditoria e histórico da unidade
    expect((await comBanco((db) => db.historicoUnidade.count({ where: { unidadeId: u.id, descricao: { contains: 'Status-Quitação' } } }))).valueOf()).toBeGreaterThan(0);
    await comBanco((db) => db.unidade.update({ where: { id: u.id }, data: { statusQuitacao: 'quitada' } }));
  });
});

test.describe('aba Chaves', () => {
  test('usa o mesmo cartão de status da aba Unidades e o admin também edita por ali', async ({ page }) => {
    // a unidade 106 tem os dados da base consolidada; cria uma entrega nela pra aparecer na aba Chaves
    await comBanco(async (db) => {
      const u = await db.unidade.findFirst({ where: { numero: '106' } });
      const tipo = await db.tipoEvento.findUnique({ where: { slug: 'entrega-chaves' } });
      const inv = await db.investidor.findFirst();
      await db.agendamento.create({
        data: { unidadeId: u.id, tipoEventoId: tipo.id, investidorId: inv.id, dataHora: new Date('2030-10-29T15:00:00Z'), qrToken: 'qr-cartao', status: 'confirmado', nomeCompareceu: 'Pessoa Cartao Teste', emailCompareceu: 'c@example.com' }
      });
    });
    await entrarComoAdmin(page);
    await page.goto('/admin/entrega-chaves', { waitUntil: 'networkidle' });
    const cartao = page.locator('.card', { hasText: 'Bloco 2 - nº 106' }).first();
    for (const texto of ['2 QUARTOS', 'Grupo A', 'Quitação: Saldo quitado', 'Vistoria: Aprovada', 'Escritura: Promessa de compra e venda']) {
      await expect(cartao.getByText(texto)).toBeVisible();
    }
    await expect(cartao.getByText(/Financiad/i)).toHaveCount(0); // informação de financiamento saiu do sistema
    await cartao.getByRole('button', { name: 'ver mais' }).click();
    await expect(cartao.getByText('Vencido pago')).toBeVisible();
    await expect(cartao.getByRole('button', { name: 'editar status' })).toBeVisible();
  });

  test('o colaborador vê o cartão, mas sem os botões de edição', async ({ page }) => {
    await entrarComoAdmin(page, COLABORADOR);
    await page.goto('/admin/entrega-chaves', { waitUntil: 'networkidle' });
    await expect(page.locator('[data-testid=unidade-status]').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'editar status' })).toHaveCount(0);
  });

  test('atualiza sozinha: um agendamento novo aparece sem F5', async ({ page }) => {
    await entrarComoAdmin(page);
    await page.goto('/admin/entrega-chaves', { waitUntil: 'networkidle' });
    await expect(page.getByText('Pessoa Polling Teste')).toHaveCount(0);
    await expect(page.getByTestId('auto-atualizacao')).toBeVisible();

    await comBanco(async (db) => {
      const u = await db.unidade.findFirst({ where: { numero: '104' } });
      const tipo = await db.tipoEvento.findUnique({ where: { slug: 'entrega-chaves' } });
      const inv = await db.investidor.findFirst();
      await db.agendamento.create({
        data: { unidadeId: u.id, tipoEventoId: tipo.id, investidorId: inv.id, dataHora: new Date('2030-10-29T14:00:00Z'), qrToken: 'qr-polling', status: 'confirmado', nomeCompareceu: 'Pessoa Polling Teste', emailCompareceu: 'p@example.com' }
      });
    });
    // sem recarregar: o ciclo de 20 s traz o agendamento novo
    await expect(page.getByText('Pessoa Polling Teste')).toBeVisible({ timeout: 45_000 });
  });
});

test.describe('dashboard', () => {
  test('atendimentos realizados × agendados e não realizados, com filtro de período', async ({ page }) => {
    await comBanco(async (db) => {
      const u = await db.unidade.findFirst({ where: { numero: '105' } });
      const tipo = await db.tipoEvento.findUnique({ where: { slug: 'entrega-chaves' } });
      const inv = await db.investidor.findFirst();
      // um já realizado e um que o horário passou sem concluir, ambos em janeiro de 2026
      for (const [i, status] of [['qr-dash-1', 'realizado'], ['qr-dash-2', 'confirmado']].map(([q, s]) => [q, s])) {
        await db.agendamento.create({
          data: { unidadeId: u.id, tipoEventoId: tipo.id, investidorId: inv.id, dataHora: new Date('2026-01-12T10:00:00Z'), qrToken: i, status, nomeCompareceu: `Dash ${status}`, emailCompareceu: 'd@example.com' }
        });
      }
    });
    await entrarComoAdmin(page);
    await page.goto('/admin/dashboard?de=2026-01-01&ate=2026-01-31', { waitUntil: 'networkidle' });
    await expect(page.getByTestId('kpi-realizados')).toHaveText('1');
    await expect(page.getByTestId('kpi-nao-realizados')).toHaveText('1');
    // fora desse intervalo não há nenhum dos dois
    await page.goto('/admin/dashboard?de=2026-02-01&ate=2026-02-28', { waitUntil: 'networkidle' });
    await expect(page.getByTestId('kpi-realizados')).toHaveText('0');
    await expect(page.getByTestId('kpi-nao-realizados')).toHaveText('0');
    // o que ainda vai acontecer (2030) conta à parte
    expect(Number(await page.getByTestId('kpi-a-fazer').innerText())).toBeGreaterThanOrEqual(1);
  });
});

test.describe('atendimento presencial', () => {
  test('navegação livre: etapas são links e a etapa bloqueada explica o motivo (sem redirecionar)', async ({ page }) => {
    await entrarComoAdmin(page);
    const id = await idAgendamento('Pessoa Faltou'); // sem retirante confirmado
    await page.goto(`/admin/entrega-chaves/${id}?passo=3`, { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/passo=3/); // não foi jogado de volta ao passo 2
    await expect(page.getByTestId('etapa-bloqueada')).toContainText('Confirme quem está retirando as chaves');
    for (const nome of ['1. Unidade', '2. Quem retira', '3. Termo', '4. Checklist', '5. Concluído']) {
      await expect(page.getByRole('link', { name: nome })).toBeVisible();
    }
    await page.getByRole('link', { name: '5. Concluído' }).click();
    await expect(page).toHaveURL(/passo=5/);
    await page.getByRole('link', { name: '1. Unidade' }).click();
    await expect(page).toHaveURL(/passo=1/);
    // checklist também mostra o motivo
    await page.goto(`/admin/entrega-chaves/${id}?passo=4`, { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/passo=4/);
    await expect(page.getByTestId('etapa-bloqueada')).toBeVisible();
  });

  test('observações substituem a lista de presença manual e vão para o resumo e para o CSV', async ({ page }) => {
    await entrarComoAdmin(page);
    const id = await idAgendamento('Pessoa Compareceu');
    await page.goto(`/admin/entrega-chaves/${id}?passo=2`, { waitUntil: 'networkidle' });
    await expect(page.getByPlaceholder('Outra pessoa presente (acompanhante)')).toHaveCount(0);
    await page.fill('#observacoes', 'Cliente pediu uma via extra das chaves.');
    await page.getByRole('button', { name: 'Salvar observações' }).click();
    await expect(page.getByText('Observações salvas.')).toBeVisible();
    expect((await comBanco((db) => db.agendamento.findUnique({ where: { id } }))).observacoesAtendimento).toBe('Cliente pediu uma via extra das chaves.');

    // resumo final
    await page.goto(`/admin/entrega-chaves/${id}?passo=5`, { waitUntil: 'networkidle' });
    await expect(page.getByTestId('observacoes-resumo')).toContainText('via extra das chaves');
    // CSVs
    const presenca = await baixar(page, '/admin/presenca/exportar');
    expect(presenca.corpo.toString('utf8')).toContain('Observações do atendimento');
    expect(presenca.corpo.toString('utf8')).toContain('Cliente pediu uma via extra das chaves.');
    const entregas = await baixar(page, '/admin/presenca/exportar-entregas');
    expect(entregas.corpo.toString('utf8')).toContain('Cliente pediu uma via extra das chaves.');
    const dash = await baixar(page, '/admin/dashboard/exportar');
    expect(dash.corpo.toString('utf8')).toContain('Cliente pediu uma via extra das chaves.');
  });

  test('resumo final de entrega concluída: um aviso verde só, sem a linha repetida', async ({ page }) => {
    await entrarComoAdmin(page);
    const id = await comBanco(async (db) => (await db.agendamento.findFirst({ where: { status: 'realizado', documentosAssinados: { some: {} } } })).id);
    await page.goto(`/admin/entrega-chaves/${id}?passo=5`, { waitUntil: 'networkidle' });
    await expect(page.getByText('Entrega concluída', { exact: true })).toHaveCount(1);
    await expect(page.getByText(/agendamento marcado como realizado/)).toHaveCount(0);
    await expect(page.getByText(/Atendimento realizado/)).toHaveCount(0);
  });

  test('"Corrigir e-mail": atualiza o e-mail de quem assina, recusa e-mail repetido e registra na auditoria', async ({ page }) => {
    await entrarComoAdmin(page);
    const id = await idAgendamento('Pessoa Compareceu');
    await page.goto(`/admin/entrega-chaves/${id}?passo=3`, { waitUntil: 'networkidle' });
    await expect(page.getByTestId('corrigir-email')).toBeVisible();
    await page.getByRole('button', { name: 'Corrigir e-mail' }).click();
    await page.fill('input[name=email]', 'e-mail-certo@example.com');
    await page.getByRole('button', { name: 'Salvar e-mail' }).click();
    await expect(page.getByText(/E-mail de Pessoa Compareceu corrigido para e-mail-certo@example.com/)).toBeVisible();
    expect((await comBanco((db) => db.agendamento.findUnique({ where: { id } }))).retiranteEmail).toBe('e-mail-certo@example.com');

    // o mesmo e-mail de novo é recusado
    await page.fill('input[name=email]', 'e-mail-certo@example.com');
    await page.getByRole('button', { name: 'Salvar e-mail' }).click();
    await expect(page.getByText('Esse já é o e-mail cadastrado.')).toBeVisible();
    // e-mail inválido (pelo servidor)
    const r = await page.request.post(`/admin/entrega-chaves/${id}?/corrigirEmail`, { form: { quem: 'cliente', email: 'sem-arroba' }, headers: acao });
    expect(await r.text()).toContain('Informe um e-mail válido');

    const log = await comBanco((db) => db.logAcesso.findFirst({ where: { acao: 'email_assinante_corrigido' } }));
    expect(log.descricao).toContain('e-mail-certo@example.com');
  });

  test('download final: um único PDF com o termo e o checklist assinados', async ({ page }) => {
    await entrarComoAdmin(page);
    const id = await comBanco(async (db) => (await db.agendamento.findFirst({ where: { status: 'realizado', documentosAssinados: { some: {} } } })).id);
    const r = await baixar(page, `/admin/entrega-chaves/${id}/documento/completo`);
    expect(r.status).toBe(200);
    expect(r.tipo).toBe('application/pdf');
    const { PDFDocument } = await import('pdf-lib');
    expect((await PDFDocument.load(r.corpo)).getPageCount()).toBe(2); // 1 página do termo + 1 do checklist (PDFs de teste)
    // continua dando pra baixar cada um separado
    expect((await baixar(page, `/admin/entrega-chaves/${id}/documento/termo`)).status).toBe(200);
    // sem os dois assinados, o completo não existe
    const faltou = await idAgendamento('Pessoa Faltou');
    expect((await baixar(page, `/admin/entrega-chaves/${faltou}/documento/completo`)).status).toBe(404);

    await page.goto('/admin/entrega-chaves', { waitUntil: 'networkidle' });
    await expect(page.getByRole('link', { name: 'PDF completo' }).first()).toBeVisible();
  });
});
