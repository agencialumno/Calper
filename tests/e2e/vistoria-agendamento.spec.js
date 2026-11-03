import { expect, test } from '@playwright/test';
import { COLABORADOR, DATAS_ABERTAS, DIA_COM_LIMITE_1 } from '../preparar-banco-teste.js';
import { comBanco } from './db.js';
import { baixar, entrarComoAdmin } from './helpers.js';

// Serviço "Vistoria" no agendamento público e nas listas. Roda SÓ no banco de teste (schema calper_test).
const ACAO = { 'x-sveltekit-action': 'true', origin: 'http://localhost:5301' };
const texto = async (r) => (await r.text()).replace(/\\u003c/g, '<');
const post = (page, acao, form) => page.request.post(`/admin/quem-agendou?/${acao}`, { form, headers: ACAO });

test.describe.configure({ mode: 'serial' });

let u; // unidades de teste (bloco 3)

test.beforeAll(async () => {
  u = await comBanco(async (db) => {
    const murano = await db.empreendimento.findFirst({ where: { nome: { contains: 'Murano', mode: 'insensitive' } } });
    const outro = await db.empreendimento.create({ data: { nome: 'Outro Empreendimento Vistoria' } });
    const nova = (numero, extra = {}) =>
      db.unidade.create({
        data: { empreendimentoId: murano.id, bloco: '3', numero, tipologia: '2 QUARTOS', vistoriaStatus: 'APROVADA', compradores: [{ nome: `COMPRADOR ${numero} VISTORIA`, principal: true }], ...extra }
      });
    const r = {};
    for (const n of ['901', '902', '903', '905', '906']) r[n] = await nova(n);
    r['904'] = await nova('904', { vistoriaStatus: 'EM ESTOQUE', compradores: [] });
    r['908'] = await nova('908', { vistoriaStatus: 'JURÍDICO' });
    r['909'] = await nova('909', { vistoriaStatus: 'UNIDADES EM NOTIFICAÇÃO' });
    // mesmo número em outro bloco: a vistoria é só do Bloco 3, e a unidade é sempre bloco + número
    r.bloco4 = await db.unidade.create({ data: { empreendimentoId: murano.id, bloco: '4', numero: '901', vistoriaStatus: 'APROVADA', compradores: [{ nome: 'COMPRADOR BLOCO 4', principal: true }] } });
    r.fora = await db.unidade.create({ data: { empreendimentoId: outro.id, bloco: '3', numero: '999', compradores: [{ nome: 'X', principal: true }] } });
    return r;
  });
});

async function abrir(page, servico) {
  await page.goto(`/agendar-entrega-chaves${servico ? `?servico=${servico}` : ''}`, { waitUntil: 'networkidle' });
}
const opcoesUnidade = async (page) => (await page.locator('#unidadeId option').allTextContents()).join('|');

async function preencher(page, { servico, unidade, data, horario, nome }) {
  await page.selectOption('#servico', servico);
  await page.fill('#nome', nome);
  await page.fill('#cpf', '529.982.247-25');
  await page.fill('#telefone', '(21) 99999-0000');
  await page.fill('#email', 'vistoria.teste@example.com');
  await page.selectOption('#unidadeId', { label: unidade });
  await page.selectOption('#data', data);
  await page.selectOption('#horario', horario);
  await page.check('input[name=ehProprietario][value=sim]');
}

test.describe('página pública: campo "Serviço"', () => {
  test('o padrão é a entrega de chaves e o dropdown tem Vistoria e Entrega de chaves', async ({ page }) => {
    await abrir(page);
    await expect(page.locator('#servico')).toHaveValue('entrega-chaves');
    expect(await page.locator('#servico option').allTextContents()).toEqual(['Vistoria', 'Entrega de chaves']);
    await expect(page.getByRole('heading', { name: 'Agendar entrega de chaves' })).toBeVisible();
  });

  test('o dropdown de unidades filtra pelo serviço e mantém as travas (estoque, jurídico, notificação, sem comprador, outro empreendimento)', async ({ page }) => {
    await abrir(page, 'vistoria');
    await expect(page.locator('#servico')).toHaveValue('vistoria');
    await expect(page.getByRole('heading', { name: 'Agendar vistoria' })).toBeVisible();
    const vistoria = await opcoesUnidade(page);
    for (const ok of ['nº 901', 'nº 902', 'nº 903']) expect(vistoria, ok).toContain(ok);
    for (const nao of ['nº 904', 'nº 908', 'nº 909', 'nº 999']) expect(vistoria, nao).not.toContain(nao);
    // trocar de serviço na tela refaz a lista sem recarregar
    await page.selectOption('#servico', 'entrega-chaves');
    expect(await opcoesUnidade(page)).toContain('nº 901');
    expect(await opcoesUnidade(page)).not.toContain('nº 904');
  });

  test('vistoria só no Bloco 3: o mesmo número em outro bloco não aparece, e o bloco aparece na lista', async ({ page }) => {
    await abrir(page, 'vistoria');
    const vistoria = await opcoesUnidade(page);
    expect(vistoria).toContain('Bloco 3 - nº 901');
    expect(vistoria).not.toContain('Bloco 4');
    await page.selectOption('#servico', 'entrega-chaves');
    expect(await opcoesUnidade(page)).toContain('Bloco 4 - nº 901');
  });

  test('agendar vistoria: grava o serviço certo, cita a vistoria nos textos e a unidade some só da lista de vistoria', async ({ page }) => {
    await abrir(page);
    await preencher(page, { servico: 'vistoria', unidade: 'Bloco 3 - nº 901', data: DATAS_ABERTAS[0], horario: '09:00', nome: 'Cliente Vistoria Um' });
    await page.click('button:has-text("Confirmar agendamento")');
    await expect(page.getByText('Agendamento realizado com sucesso')).toBeVisible();
    await expect(page.getByTestId('resumo-servico')).toHaveText('Vistoria');

    const ag = await comBanco((db) => db.agendamento.findFirst({ where: { nomeCompareceu: 'Cliente Vistoria Um' }, include: { tipoEvento: true } }));
    expect(ag.tipoEvento.slug).toBe('vistoria');
    expect(ag.vistoriaNumero).toBe(1);
    const hist = await comBanco((db) => db.historicoUnidade.findFirst({ where: { unidadeId: u['901'].id, descricao: { contains: 'agendada para' } } }));
    expect(hist.descricao).toMatch(/^Vistoria agendada para/);
    const log = await comBanco((db) => db.logAcesso.findFirst({ where: { entidadeId: ag.id, acao: 'agendamento_criado' } }));
    expect(log.descricao).toContain('agendou vistoria pelo formulário público');
    expect(await comBanco((db) => db.notificacao.count({ where: { titulo: 'Nova vistoria agendada' } }))).toBeGreaterThan(0);

    await abrir(page, 'vistoria');
    expect(await opcoesUnidade(page)).not.toContain('nº 901');
    // as regras são independentes por serviço: a mesma unidade ainda pode agendar a entrega de chaves
    await page.selectOption('#servico', 'entrega-chaves');
    expect(await opcoesUnidade(page)).toContain('nº 901');
  });

  test('uma unidade com entrega agendada ainda agenda vistoria', async ({ page }) => {
    await comBanco(async (db) => {
      const tipo = await db.tipoEvento.findUnique({ where: { slug: 'entrega-chaves' } });
      const inv = await db.investidor.findFirst();
      await db.agendamento.create({ data: { unidadeId: u['902'].id, tipoEventoId: tipo.id, investidorId: inv.id, dataHora: new Date('2030-10-29T16:00:00Z'), qrToken: 'qr-vist-902', nomeCompareceu: 'Entrega Dois' } });
    });
    await abrir(page, 'vistoria');
    expect(await opcoesUnidade(page)).toContain('nº 902');
    await page.selectOption('#servico', 'entrega-chaves');
    expect(await opcoesUnidade(page)).not.toContain('nº 902');
  });
});

test.describe('uma vistoria ativa por unidade', () => {
  test('vistoria não cancelada tira a unidade da lista pública e o servidor recusa o envio direto; cancelada libera', async ({ page }) => {
    await comBanco(async (db) => {
      const tipo = await db.tipoEvento.findUnique({ where: { slug: 'vistoria' } });
      const inv = await db.investidor.findFirst();
      const base = { tipoEventoId: tipo.id, investidorId: inv.id, dataHora: new Date('2030-10-29T14:00:00Z') };
      await db.agendamento.create({ data: { ...base, unidadeId: u['903'].id, qrToken: 'qr-vist-903', nomeCompareceu: 'Vistoria Ativa' } });
      await db.agendamento.create({ data: { ...base, unidadeId: u['905'].id, qrToken: 'qr-vist-905', nomeCompareceu: 'Vistoria Cancelada', status: 'cancelado' } });
    });
    await abrir(page, 'vistoria');
    const opcoes = await opcoesUnidade(page);
    expect(opcoes).not.toContain('nº 903'); // vistoria ativa
    expect(opcoes).toContain('nº 905'); // só havia uma cancelada: volta a ficar disponível

    // mesmo burlando a tela, o servidor confere de novo
    const r = await page.request.post('/agendar-entrega-chaves', {
      form: { servico: 'vistoria', nome: 'Cliente Burla', cpf: '529.982.247-25', telefone: '(21) 99999-0000', email: 'b@example.com', ehProprietario: 'sim', unidadeId: u['903'].id, data: DATAS_ABERTAS[1], horario: '10:00' },
      headers: ACAO
    });
    expect(await texto(r)).toContain('já tem vistoria agendada');
    expect(await comBanco((db) => db.agendamento.count({ where: { nomeCompareceu: 'Cliente Burla' } }))).toBe(0);
  });
});

test.describe('vagas por serviço', () => {
  test('lotar o horário da vistoria não tira a vaga da entrega de chaves', async ({ page }) => {
    // o dia 30 tem limite de 1 por hora
    await abrir(page);
    await preencher(page, { servico: 'vistoria', unidade: 'Bloco 3 - nº 906', data: DIA_COM_LIMITE_1, horario: '15:00', nome: 'Lotacao Vistoria' });
    await page.click('button:has-text("Confirmar agendamento")');
    await expect(page.getByText('Agendamento realizado com sucesso')).toBeVisible();

    await abrir(page, 'vistoria');
    await page.selectOption('#data', DIA_COM_LIMITE_1);
    await expect(page.locator('#horario option', { hasText: '15:00' })).toContainText('(indisponível)');
    await page.selectOption('#servico', 'entrega-chaves');
    await page.selectOption('#data', DIA_COM_LIMITE_1);
    await expect(page.locator('#horario option', { hasText: '15:00' })).not.toContainText('(indisponível)');
    await expect(page.locator('#horario option', { hasText: '15:00' })).toBeEnabled();
  });
});

test.describe('equipe: Quem agendou e gestão da vistoria', () => {
  test('lista os dois serviços, com a coluna Serviço, filtro e CSV', async ({ page }) => {
    await entrarComoAdmin(page);
    await page.goto('/admin/quem-agendou', { waitUntil: 'networkidle' });
    await expect(page.locator('[data-testid=selo-servico]', { hasText: 'Vistoria' }).first()).toBeVisible();
    await expect(page.locator('[data-testid=selo-servico]', { hasText: 'Entrega de chaves' }).first()).toBeVisible();

    await page.goto('/admin/quem-agendou?servico=vistoria', { waitUntil: 'networkidle' });
    await expect(page.locator('[data-testid=selo-servico]', { hasText: 'Entrega de chaves' })).toHaveCount(0);
    await expect(page.getByText('Cliente Vistoria Um', { exact: true })).toBeVisible();

    const csv = (await baixar(page, '/admin/quem-agendou/exportar')).corpo.toString('utf8');
    expect(csv.split('\n')[0]).toContain('Serviço');
    expect(csv).toContain('Vistoria');
    const soVistoria = (await baixar(page, '/admin/quem-agendou/exportar?servico=vistoria')).corpo.toString('utf8');
    expect(soVistoria).not.toContain('Entrega de chaves');
  });

  test('remarcar e desmarcar a vistoria usam as vagas da vistoria; o colaborador não pode', async ({ page }) => {
    const id = await comBanco(async (db) => (await db.agendamento.findFirst({ where: { nomeCompareceu: 'Cliente Vistoria Um' } })).id);
    await entrarComoAdmin(page);
    // 15:00 do dia 30 está lotado PARA VISTORIA (Lotacao Vistoria): recusa
    expect(await texto(await post(page, 'remarcar', { agendamentoId: id, data: DIA_COM_LIMITE_1, horario: '15:00' }))).toContain('acabou de lotar');
    // 16:00 do dia 30 tem vaga de vistoria: remarca
    expect(await texto(await post(page, 'remarcar', { agendamentoId: id, data: DIA_COM_LIMITE_1, horario: '16:00' }))).toContain('Remarcado');
    const hist = await comBanco((db) => db.historicoUnidade.findFirst({ where: { unidadeId: u['901'].id, descricao: { contains: 'remarcado' } } }));
    expect(hist.descricao).toContain('Agendamento de vistoria remarcado');
    const log = await comBanco((db) => db.logAcesso.findFirst({ where: { entidadeId: id, acao: 'agendamento_remarcado' } }));
    expect(log.descricao).toContain('agendamento de vistoria');

    // colaborador: barrado
    await page.context().clearCookies();
    await entrarComoAdmin(page, COLABORADOR);
    expect((await post(page, 'desmarcar', { agendamentoId: id, motivo: 'tentativa' })).status()).toBe(403);
    expect((await comBanco((db) => db.agendamento.findUnique({ where: { id } }))).status).toBe('confirmado');

    // admin desmarca: a unidade volta à lista pública de vistoria e o registro continua
    await page.context().clearCookies();
    await entrarComoAdmin(page);
    expect(await texto(await post(page, 'desmarcar', { agendamentoId: id, motivo: 'Cliente pediu' }))).toContain('desmarcado');
    expect((await comBanco((db) => db.agendamento.findUnique({ where: { id } }))).status).toBe('cancelado');
    await abrir(page, 'vistoria');
    expect(await opcoesUnidade(page)).toContain('nº 901');
  });

  test('o atendimento de entrega de chaves continua fechado para agendamentos de vistoria', async ({ page }) => {
    const id = await comBanco(async (db) => (await db.agendamento.findFirst({ where: { nomeCompareceu: 'Vistoria Ativa' } })).id);
    await entrarComoAdmin(page);
    const r = await page.request.get(`/admin/entrega-chaves/${id}`);
    expect(r.status()).toBe(404);
  });
});
