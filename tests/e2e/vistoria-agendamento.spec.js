import { expect, test } from '@playwright/test';
import { COLABORADOR, DATAS_ABERTAS, DIA_COM_LIMITE_1, SUPERVISOR } from '../preparar-banco-teste.js';
import { comBanco } from './db.js';
import { baixar, entrarComoAdmin } from './helpers.js';

// Vistoria: página de escolha, página própria de vistoria (só Bloco 3), agenda própria e regra do Bloco 3 na entrega.
// Roda SÓ no banco de teste (schema calper_test).
const ACAO = { 'x-sveltekit-action': 'true', origin: 'http://localhost:5301' };
const texto = async (r) => (await r.text()).replace(/\\u003c/g, '<');
const post = (page, acao, form) => page.request.post(`/admin/quem-agendou?/${acao}`, { form, headers: ACAO });
const postAgenda = (page, acao, form) => page.request.post(`/admin/agenda-vistoria?/${acao}`, { form, headers: ACAO });
const MSG_BLOCO3 = 'Ainda não é possível agendar a entrega de chaves para o Bloco 3.';

test.describe.configure({ mode: 'serial' });

let u; // unidades de teste (bloco 3 para vistoria; bloco 4 com o mesmo número)

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
    // mesmo número em outro bloco: a unidade é sempre bloco + número
    r.bloco4 = await db.unidade.create({ data: { empreendimentoId: murano.id, bloco: '4', numero: '901', vistoriaStatus: 'APROVADA', compradores: [{ nome: 'COMPRADOR BLOCO 4', principal: true }] } });
    r.fora = await db.unidade.create({ data: { empreendimentoId: outro.id, bloco: '3', numero: '999', compradores: [{ nome: 'X', principal: true }] } });
    return r;
  });
});

const opcoesUnidade = async (page) => (await page.locator('#unidadeId option').allTextContents()).join('|');
const abrirVistoria = (page) => page.goto('/agendar-vistoria', { waitUntil: 'networkidle' });
const abrirEntrega = (page) => page.goto('/agendar-entrega-chaves', { waitUntil: 'networkidle' });

async function preencher(page, { unidade, data, horario, nome }) {
  await page.fill('#nome', nome);
  await page.fill('#cpf', '529.982.247-25');
  await page.fill('#telefone', '(21) 99999-0000');
  await page.fill('#email', 'vistoria.teste@example.com');
  await page.selectOption('#unidadeId', { label: unidade });
  await page.selectOption('#data', data);
  await page.selectOption('#horario', horario);
  await page.check('input[name=ehProprietario][value=sim]');
}

const formEnvio = (extra) => ({ nome: 'Cliente Burla', cpf: '529.982.247-25', telefone: '(21) 99999-0000', email: 'b@example.com', ehProprietario: 'sim', data: DATAS_ABERTAS[1], horario: '10:00', ...extra });

test.describe('página de escolha', () => {
  test('mostra o convite e os dois botões, cada um levando à sua página', async ({ page }) => {
    await page.goto('/agendamento', { waitUntil: 'networkidle' });
    await expect(page.getByText('Por favor, selecione a opção que deseja')).toBeVisible();
    await expect(page.getByTestId('escolha-entrega')).toHaveText('Agendar entrega de chaves');
    await expect(page.getByTestId('escolha-vistoria')).toHaveText('Agendar vistoria');
    await page.getByTestId('escolha-vistoria').click();
    await expect(page).toHaveURL(/\/agendar-vistoria$/);
    await page.goto('/agendamento');
    await page.getByTestId('escolha-entrega').click();
    await expect(page).toHaveURL(/\/agendar-entrega-chaves$/);
  });
});

test.describe('entrega de chaves: página igual à de antes, com a regra do Bloco 3', () => {
  test('sem campo Serviço; o Bloco 3 mostra o erro e bloqueia o envio', async ({ page }) => {
    await abrirEntrega(page);
    await expect(page.locator('#servico')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Agendar entrega de chaves' })).toBeVisible();
    await preencher(page, { unidade: 'Bloco 3 - nº 901', data: DATAS_ABERTAS[0], horario: '09:00', nome: 'Entrega Bloco Tres' });
    await expect(page.getByText(MSG_BLOCO3)).toBeVisible();
    await page.click('button:has-text("Confirmar agendamento")');
    await expect(page.getByText('Agendamento realizado com sucesso')).toHaveCount(0);
    expect(await comBanco((db) => db.agendamento.count({ where: { nomeCompareceu: 'Entrega Bloco Tres' } }))).toBe(0);
    // outro bloco com o mesmo número continua liberado
    await page.selectOption('#unidadeId', { label: 'Bloco 4 - nº 901' });
    await expect(page.getByText(MSG_BLOCO3)).toHaveCount(0);
  });

  test('o servidor também recusa a entrega no Bloco 3, com a mesma mensagem', async ({ page }) => {
    const r = await page.request.post('/agendar-entrega-chaves', { form: formEnvio({ unidadeId: u['902'].id }), headers: ACAO });
    expect(await texto(r)).toContain(MSG_BLOCO3);
    expect(await comBanco((db) => db.agendamento.count({ where: { nomeCompareceu: 'Cliente Burla' } }))).toBe(0);
  });
});

test.describe('agenda de vistoria separada', () => {
  test('começa fechada: a página de vistoria não tem datas, e a entrega não é afetada', async ({ page }) => {
    await abrirVistoria(page);
    await expect(page.getByText('No momento não há datas abertas para agendamento.')).toBeVisible();
    expect(await page.locator('#data option').count()).toBe(1);
    await abrirEntrega(page);
    expect(await page.locator('#data option').count()).toBeGreaterThan(1);
  });

  test('colaborador não abre dias; supervisor e admin abrem; o limite do dia é só da vistoria', async ({ page }) => {
    await entrarComoAdmin(page, COLABORADOR);
    expect((await postAgenda(page, 'adicionarDia', { data: DATAS_ABERTAS[0] })).status()).toBe(403);
    expect(await comBanco((db) => db.agendaDiaVistoria.count())).toBe(0);

    await page.context().clearCookies();
    await entrarComoAdmin(page, SUPERVISOR);
    await postAgenda(page, 'adicionarDia', { data: DATAS_ABERTAS[0] });
    await page.context().clearCookies();
    await entrarComoAdmin(page);
    await postAgenda(page, 'adicionarDia', { data: DATAS_ABERTAS[1] });
    await postAgenda(page, 'adicionarDia', { data: DIA_COM_LIMITE_1 });
    const dias = await comBanco((db) => db.agendaDiaVistoria.findMany({ orderBy: { data: 'asc' } }));
    expect(dias.map((d) => d.data)).toEqual([...DATAS_ABERTAS]);
    const dia30 = dias.find((d) => d.data === DIA_COM_LIMITE_1);
    await postAgenda(page, 'salvarDia', { id: dia30.id, aberto: 'on', limitePorHora: '1' });
    expect(await comBanco((db) => db.agendaDia.count())).toBe(3); // a agenda de entrega não mudou

    await page.goto('/admin/agenda-vistoria', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Agenda de vistoria' })).toBeVisible();
    await abrirVistoria(page);
    expect(await page.locator('#data option').count()).toBe(4);
  });
});

test.describe('página de vistoria: só Bloco 3', () => {
  test('mostra o aviso e lista só unidades do Bloco 3, com as travas de hoje', async ({ page }) => {
    await abrirVistoria(page);
    await expect(page.getByRole('heading', { name: 'Agendar vistoria' })).toBeVisible();
    await expect(page.getByTestId('aviso-bloco-vistoria')).toContainText('A vistoria está disponível apenas para o Bloco 3. O período de vistoria do Bloco 2 já passou.');
    const lista = await opcoesUnidade(page);
    expect(lista).toContain('Bloco 3 - nº 901');
    for (const ok of ['nº 902', 'nº 903']) expect(lista).toContain(ok);
    expect(lista).not.toContain('Bloco 4');
    expect(lista).not.toContain('Bloco 2');
    for (const nao of ['nº 904', 'nº 908', 'nº 909', 'nº 999']) expect(lista).not.toContain(nao);
  });

  test('o servidor recusa unidade de outro bloco', async ({ page }) => {
    const r = await page.request.post('/agendar-vistoria', { form: formEnvio({ unidadeId: u.bloco4.id }), headers: ACAO });
    expect(await texto(r)).toContain('Escolha uma unidade da lista');
    const bloco2 = await comBanco((db) => db.unidade.findFirst({ where: { bloco: '2', numero: '101' } }));
    const r2 = await page.request.post('/agendar-vistoria', { form: formEnvio({ unidadeId: bloco2.id }), headers: ACAO });
    expect(await texto(r2)).toContain('Escolha uma unidade da lista');
    expect(await comBanco((db) => db.agendamento.count({ where: { nomeCompareceu: 'Cliente Burla' } }))).toBe(0);
  });

  test('agendar vistoria: grava o serviço certo, cita a vistoria nos textos e a unidade some da lista', async ({ page }) => {
    await abrirVistoria(page);
    await preencher(page, { unidade: 'Bloco 3 - nº 901', data: DATAS_ABERTAS[0], horario: '09:00', nome: 'Cliente Vistoria Um' });
    await page.click('button:has-text("Confirmar agendamento")');
    await expect(page.getByText('Agendamento de vistoria realizado com sucesso')).toBeVisible();
    await expect(page.getByTestId('resumo-servico')).toHaveText('Vistoria');

    const ag = await comBanco((db) => db.agendamento.findFirst({ where: { nomeCompareceu: 'Cliente Vistoria Um' }, include: { tipoEvento: true } }));
    expect(ag.tipoEvento.slug).toBe('vistoria');
    expect(ag.vistoriaNumero).toBe(1);
    const hist = await comBanco((db) => db.historicoUnidade.findFirst({ where: { unidadeId: u['901'].id, descricao: { contains: 'agendada para' } } }));
    expect(hist.descricao).toMatch(/^Vistoria agendada para/);
    const log = await comBanco((db) => db.logAcesso.findFirst({ where: { entidadeId: ag.id, acao: 'agendamento_criado' } }));
    expect(log.descricao).toContain('agendou vistoria pelo formulário público');
    expect(await comBanco((db) => db.notificacao.count({ where: { titulo: 'Nova vistoria agendada' } }))).toBeGreaterThan(0);

    await abrirVistoria(page);
    expect(await opcoesUnidade(page)).not.toContain('nº 901');
  });
});

test.describe('uma vistoria ativa por unidade', () => {
  test('vistoria não cancelada tira a unidade da lista e o servidor recusa o envio direto; cancelada libera', async ({ page }) => {
    await comBanco(async (db) => {
      const tipo = await db.tipoEvento.findUnique({ where: { slug: 'vistoria' } });
      const inv = await db.investidor.findFirst();
      const base = { tipoEventoId: tipo.id, investidorId: inv.id, dataHora: new Date('2030-10-29T14:00:00Z') };
      await db.agendamento.create({ data: { ...base, unidadeId: u['903'].id, qrToken: 'qr-vist-903', nomeCompareceu: 'Vistoria Ativa' } });
      await db.agendamento.create({ data: { ...base, unidadeId: u['905'].id, qrToken: 'qr-vist-905', nomeCompareceu: 'Vistoria Cancelada', status: 'cancelado' } });
    });
    await abrirVistoria(page);
    const opcoes = await opcoesUnidade(page);
    expect(opcoes).not.toContain('nº 903');
    expect(opcoes).toContain('nº 905');
    const r = await page.request.post('/agendar-vistoria', { form: formEnvio({ unidadeId: u['903'].id }), headers: ACAO });
    expect(await texto(r)).toContain('já tem vistoria agendada');
    expect(await comBanco((db) => db.agendamento.count({ where: { nomeCompareceu: 'Cliente Burla' } }))).toBe(0);
  });
});

test.describe('vagas da vistoria', () => {
  test('lotar o horário da vistoria não tira a vaga da entrega de chaves', async ({ page }) => {
    await abrirVistoria(page);
    await preencher(page, { unidade: 'Bloco 3 - nº 906', data: DIA_COM_LIMITE_1, horario: '15:00', nome: 'Lotacao Vistoria' });
    await page.click('button:has-text("Confirmar agendamento")');
    await expect(page.getByText('Agendamento de vistoria realizado com sucesso')).toBeVisible();

    await abrirVistoria(page);
    await page.selectOption('#data', DIA_COM_LIMITE_1);
    await expect(page.locator('#horario option', { hasText: '15:00' })).toContainText('(indisponível)');
    await abrirEntrega(page);
    await page.selectOption('#data', DIA_COM_LIMITE_1);
    await expect(page.locator('#horario option', { hasText: '15:00' })).not.toContainText('(indisponível)');
  });
});

test.describe('equipe: Quem agendou e gestão da vistoria', () => {
  test('o padrão continua só entrega; vistoria e todos aparecem pelo filtro, com a coluna Serviço no CSV', async ({ page }) => {
    await entrarComoAdmin(page);
    await page.goto('/admin/quem-agendou', { waitUntil: 'networkidle' });
    await expect(page.getByTestId('selo-servico')).toHaveCount(0);
    await expect(page.getByText('Cliente Vistoria Um', { exact: true })).toHaveCount(0);

    await page.goto('/admin/quem-agendou?servico=vistoria', { waitUntil: 'networkidle' });
    await expect(page.getByText('Cliente Vistoria Um', { exact: true })).toBeVisible();
    await expect(page.locator('[data-testid=selo-servico]', { hasText: 'Entrega de chaves' })).toHaveCount(0);

    await page.goto('/admin/quem-agendou?servico=todos', { waitUntil: 'networkidle' });
    await expect(page.locator('[data-testid=selo-servico]', { hasText: 'Entrega de chaves' }).first()).toBeVisible();

    const padrao = (await baixar(page, '/admin/quem-agendou/exportar')).corpo.toString('utf8');
    expect(padrao.split('\n')[0]).not.toContain('Serviço');
    const csv = (await baixar(page, '/admin/quem-agendou/exportar?servico=vistoria')).corpo.toString('utf8');
    expect(csv.split('\n')[0]).toContain('Serviço');
    expect(csv).not.toContain('Entrega de chaves');
  });

  test('remarcar e desmarcar a vistoria usam as vagas da vistoria; o colaborador não pode', async ({ page }) => {
    const id = await comBanco(async (db) => (await db.agendamento.findFirst({ where: { nomeCompareceu: 'Cliente Vistoria Um' } })).id);
    await entrarComoAdmin(page);
    expect(await texto(await post(page, 'remarcar', { agendamentoId: id, data: DIA_COM_LIMITE_1, horario: '15:00' }))).toContain('acabou de lotar');
    expect(await texto(await post(page, 'remarcar', { agendamentoId: id, data: DIA_COM_LIMITE_1, horario: '16:00' }))).toContain('Remarcado');
    const log = await comBanco((db) => db.logAcesso.findFirst({ where: { entidadeId: id, acao: 'agendamento_remarcado' } }));
    expect(log.descricao).toContain('agendamento de vistoria');

    await page.context().clearCookies();
    await entrarComoAdmin(page, COLABORADOR);
    expect((await post(page, 'desmarcar', { agendamentoId: id, motivo: 'tentativa' })).status()).toBe(403);

    await page.context().clearCookies();
    await entrarComoAdmin(page);
    expect(await texto(await post(page, 'desmarcar', { agendamentoId: id, motivo: 'Cliente pediu' }))).toContain('desmarcado');
    expect((await comBanco((db) => db.agendamento.findUnique({ where: { id } }))).status).toBe('cancelado');
    await abrirVistoria(page);
    expect(await opcoesUnidade(page)).toContain('nº 901');
  });

  test('o atendimento de entrega de chaves continua fechado para agendamentos de vistoria', async ({ page }) => {
    const id = await comBanco(async (db) => (await db.agendamento.findFirst({ where: { nomeCompareceu: 'Vistoria Ativa' } })).id);
    await entrarComoAdmin(page);
    expect((await page.request.get(`/admin/entrega-chaves/${id}`)).status()).toBe(404);
  });
});

test.afterAll(async () => {
  // limpeza do que ESTE arquivo criou (só no banco de teste), para não afetar as outras specs
  await comBanco(async (db) => {
    const unidades = await db.unidade.findMany({ where: { OR: [{ bloco: '3', numero: { startsWith: '9' } }, { bloco: '4', numero: '901' }] }, select: { id: true } });
    const ids = unidades.map((x) => x.id);
    const ags = await db.agendamento.findMany({ where: { unidadeId: { in: ids } }, select: { id: true } });
    await db.logAcesso.deleteMany({ where: { entidadeId: { in: ags.map((a) => a.id) } } });
    await db.procuracaoUnidade.deleteMany({ where: { unidadeId: { in: ids } } });
    await db.historicoUnidade.deleteMany({ where: { unidadeId: { in: ids } } });
    await db.agendamento.deleteMany({ where: { unidadeId: { in: ids } } });
    await db.unidade.deleteMany({ where: { id: { in: ids } } });
    await db.agendaDiaVistoria.deleteMany();
    await db.empreendimento.deleteMany({ where: { nome: 'Outro Empreendimento Vistoria' } });
  });
});
