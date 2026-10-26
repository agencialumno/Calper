import { expect, test } from '@playwright/test';
import { COLABORADOR, SUPERVISOR } from '../preparar-banco-teste.js';
import { comBanco } from './db.js';
import { baixar, entrarComoAdmin } from './helpers.js';

// Unidades próprias deste teste (bloco 9), para não depender das demais specs.
async function criarUnidades() {
  return comBanco(async (db) => {
    const murano = await db.empreendimento.findFirst({ where: { nome: { contains: 'Murano', mode: 'insensitive' } } });
    const base = { empreendimentoId: murano.id, bloco: '9', tipologia: '2 QUARTOS' };
    const livre = await db.unidade.create({ data: { ...base, numero: '902', vistoriaStatus: 'APROVADA', compradores: [{ nome: 'COMPRADOR DIRETO TESTE', principal: true }] } });
    const estoque = await db.unidade.create({ data: { ...base, numero: '901', vistoriaStatus: 'EM ESTOQUE', compradores: [] } });
    const juridico = await db.unidade.create({ data: { ...base, numero: '903', vistoriaStatus: 'JURÍDICO', compradores: [{ nome: 'COMPRADOR JURIDICO TESTE', principal: true }] } });
    return { livreId: livre.id, estoqueId: estoque.id, juridicoId: juridico.id };
  });
}

test.describe.configure({ mode: 'serial' });

// Desfaz o que este arquivo criou: os testes seguintes compartilham o banco e contam unidades/agendamentos.
async function limparTudo(ids) {
  await comBanco(async (db) => {
    const unidades = Object.values(ids ?? {});
    const ags = await db.agendamento.findMany({ where: { unidadeId: { in: unidades } }, select: { id: true } });
    await db.logAcesso.deleteMany({ where: { OR: [{ entidadeId: { in: ags.map((a) => a.id) } }, { descricao: { contains: 'Bloco 9' } }] } });
    await db.historicoUnidade.deleteMany({ where: { unidadeId: { in: unidades } } });
    await db.agendamento.deleteMany({ where: { unidadeId: { in: unidades } } });
    await db.unidade.deleteMany({ where: { id: { in: unidades } } });
    await db.investidor.deleteMany({ where: { cpf: '00000000000' } });
  });
}

test.describe('Iniciar atendimento direto (sem agendamento)', () => {
  let ids;
  test.beforeAll(async () => {
    ids = await criarUnidades();
  });
  test.afterAll(async () => {
    await limparTudo(ids);
  });

  test('colaborador inicia pelo dossiê: cria o agendamento de agora, com check-in, e abre o fluxo no passo 1', async ({ page }) => {
    await entrarComoAdmin(page, COLABORADOR);
    await page.goto(`/admin/unidades/${ids.livreId}`, { waitUntil: 'networkidle' });
    const antes = Date.now();
    await page.getByRole('button', { name: 'Iniciar atendimento' }).click();
    await page.waitForURL(/\/admin\/entrega-chaves\/[^/?]+\?passo=1/);
    await expect(page.getByTestId('selo-direto')).toBeVisible();
    await expect(page.getByText('sem agendamento prévio').first()).toBeVisible();
    // o fluxo normal: passos Unidade, Quem retira, Termo, Checklist, Concluído
    await expect(page.getByText('Situação da unidade', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Continuar' })).toBeVisible();

    const ag = await comBanco((db) => db.agendamento.findFirst({ where: { unidadeId: ids.livreId }, include: { investidor: true } }));
    expect(ag).toMatchObject({ origem: 'atendimento_direto', status: 'confirmado', nomeCompareceu: 'Atendimento direto' });
    expect(ag.checkinEm).not.toBeNull();
    // dia e hora de agora (relógio de Brasília gravado como UTC): perto do instante do clique, com folga de fuso
    const brasilia = new Date(antes - 3 * 3600e3);
    expect(Math.abs(ag.dataHora.getTime() - brasilia.getTime())).toBeLessThan(10 * 60e3);
    // log de auditoria e histórico da unidade
    const log = await comBanco((db) => db.logAcesso.findFirst({ where: { acao: 'atendimento_direto_iniciado', entidadeId: ag.id } }));
    expect(log.descricao).toContain('sem agendamento prévio');
    expect(log.descricao).toContain('Unidade 902, Bloco 9');
    expect(log.descricao).toContain('Colaborador');
    expect(await comBanco((db) => db.historicoUnidade.count({ where: { unidadeId: ids.livreId, descricao: { contains: 'sem agendamento prévio' } } }))).toBe(1);
  });

  test('clicar de novo abre o MESMO atendimento: nunca cria um segundo agendamento', async ({ page }) => {
    await entrarComoAdmin(page, SUPERVISOR);
    await page.goto(`/admin/unidades/${ids.livreId}`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('button', { name: 'Iniciar atendimento' })).toHaveCount(0);
    await page.getByRole('link', { name: 'Abrir atendimento' }).click();
    await page.waitForURL(/\/admin\/entrega-chaves\//);
    expect(await comBanco((db) => db.agendamento.count({ where: { unidadeId: ids.livreId } }))).toBe(1);
    // chamada direta repetida à ação também só abre o existente
    const r = await page.request.post('/admin/entrega-chaves?/iniciarDireto', {
      form: { unidadeId: ids.livreId },
      headers: { 'x-sveltekit-action': 'true', origin: 'http://localhost:5301' },
      maxRedirects: 0
    });
    expect([200, 303]).toContain(r.status());
    expect(await comBanco((db) => db.agendamento.count({ where: { unidadeId: ids.livreId } }))).toBe(1);
  });

  test('unidades fora do agendamento não iniciam: a tela mostra o motivo e nada é criado', async ({ page }) => {
    await entrarComoAdmin(page, COLABORADOR);
    for (const [id, motivo] of [[ids.estoqueId, 'vistoria: EM ESTOQUE'], [ids.juridicoId, 'vistoria: JURÍDICO']]) {
      await page.goto(`/admin/unidades/${id}`, { waitUntil: 'networkidle' });
      await expect(page.getByTestId('atendimento-bloqueado')).toContainText(`Atendimento indisponível: ${motivo}`);
      await expect(page.getByRole('button', { name: 'Iniciar atendimento' })).toHaveCount(0);
      // mesmo forçando a chamada, o servidor recusa
      const r = await page.request.post('/admin/entrega-chaves?/iniciarDireto', {
        form: { unidadeId: id },
        headers: { 'x-sveltekit-action': 'true', origin: 'http://localhost:5301' }
      });
      expect(await r.text()).toContain('não inicia atendimento');
      expect(await comBanco((db) => db.agendamento.count({ where: { unidadeId: id } }))).toBe(0);
    }
  });

  test('a aba Unidades também tem o botão (abrir, e o motivo nas bloqueadas)', async ({ page }) => {
    await entrarComoAdmin(page, COLABORADOR);
    // 902: já tem atendimento aberto → "Abrir atendimento"
    await page.goto('/admin/unidades?q=COMPRADOR DIRETO TESTE', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Expandir tudo/ }).click();
    await expect(page.getByRole('link', { name: 'Abrir atendimento' }).first()).toBeVisible();
    // 903 (jurídico): bloqueada, com o motivo
    await page.goto('/admin/unidades?q=COMPRADOR JURIDICO TESTE', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Expandir tudo/ }).click();
    await expect(page.getByTestId('atendimento-bloqueado').first()).toContainText('Atendimento indisponível: vistoria: JURÍDICO');
  });

  test('o atendimento direto entra marcado em "Quem agendou", nas listas e nos CSVs', async ({ page }) => {
    await entrarComoAdmin(page, SUPERVISOR);
    await page.goto('/admin/quem-agendou', { waitUntil: 'networkidle' });
    await expect(page.getByTestId('selo-direto').first()).toBeVisible();
    await page.goto('/admin/entrega-chaves', { waitUntil: 'networkidle' });
    await expect(page.getByTestId('selo-direto').first()).toBeVisible();
    await page.goto('/admin/presenca', { waitUntil: 'networkidle' });
    // check-in feito: aparece em "ainda não receberam" como compareceu
    await expect(page.locator('#faltam')).toContainText('Atendimento direto');
    await expect(page.locator('#faltam')).toContainText('compareceu — entrega não concluída');

    for (const [caminho, coluna] of [
      ['/admin/quem-agendou/exportar', 'Origem'],
      ['/admin/dashboard/exportar', 'Origem'],
      ['/admin/presenca/exportar-entregas', 'Origem']
    ]) {
      const r = await baixar(page, caminho);
      expect(r.status, caminho).toBe(200);
      const texto = r.corpo.toString('utf8');
      const cabecalho = texto.split('\r\n')[0];
      expect(cabecalho, caminho).toContain(coluna);
      expect(texto, caminho).toContain('Atendimento direto');
    }
  });

  test('a unidade com atendimento direto em aberto some do "ainda não agendou" do público', async ({ page }) => {
    await page.goto('/agendar-entrega-chaves', { waitUntil: 'networkidle' });
    const opcoes = (await page.locator('#unidadeId option').allTextContents()).join('|');
    expect(opcoes).not.toContain('nº 902'); // 1 unidade = 1 agendamento de entrega de chaves
  });
});
