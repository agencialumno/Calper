import { expect, test } from '@playwright/test';
import { COLABORADOR, SUPERVISOR } from '../preparar-banco-teste.js';
import { comBanco } from './db.js';
import { baixar, entrarComoAdmin } from './helpers.js';

// Alterar (trocar unidade), Remarcar e Desmarcar. Roda SÓ no banco de teste (schema calper_test).
const ACAO = { 'x-sveltekit-action': 'true', origem: 'http://localhost:5301' };
const PDF = 'data:application/pdf;base64,' + Buffer.from('%PDF-1.4 arquivo antigo').toString('base64');
const PNG = 'data:image/png;base64,' + Buffer.from('identidade antiga').toString('base64');

test.describe.configure({ mode: 'serial' });

let d; // dados criados

async function criarCenario() {
  return comBanco(async (db) => {
    const murano = await db.empreendimento.findFirst({ where: { nome: { contains: 'Murano', mode: 'insensitive' } } });
    const outroEmp = await db.empreendimento.create({ data: { nome: 'Outro Empreendimento Teste' } });
    const tipo = await db.tipoEvento.findUnique({ where: { slug: 'entrega-chaves' } });
    const inv = await db.investidor.findFirst();
    const unidade = (numero, extra = {}) =>
      db.unidade.create({
        data: { empreendimentoId: murano.id, bloco: '8', numero, tipologia: '2 QUARTOS', vistoriaStatus: 'APROVADA', compradores: [{ nome: `COMPRADOR ${numero} GESTAO`, principal: true }], ...extra }
      });
    const u = {};
    for (const n of ['801', '802', '803', '805', '806', '807', '808', '809', '810', '811', '812']) u[n] = await unidade(n);
    u['804'] = await unidade('804', { vistoriaStatus: 'EM ESTOQUE', compradores: [] });
    u.fora = await db.unidade.create({ data: { empreendimentoId: outroEmp.id, bloco: '8', numero: '899', compradores: [{ nome: 'X', principal: true }] } });
    const ag = (nome, unidadeId, extra = {}) =>
      db.agendamento.create({
        data: { unidadeId, tipoEventoId: tipo.id, investidorId: inv.id, dataHora: new Date('2030-10-28T15:00:00Z'), qrToken: `qr-gestao-${nome}`, status: 'confirmado', nomeCompareceu: nome, ...extra }
      });
    const a = {};
    a.alterar = await ag('Gestao Alterar', u['801'].id, { documentoBase64: PNG, procuracaoBase64: PDF, procuracaoCpf: '52998224725', ehProprietario: false });
    a.conflito = await ag('Gestao Conflito', u['803'].id, { dataHora: new Date('2030-10-28T16:00:00Z') });
    a.iniciado = await ag('Gestao Iniciado', u['805'].id, { dataHora: new Date('2030-10-29T09:00:00Z'), retiranteNome: 'JA COMECOU' });
    a.realizado = await ag('Gestao Realizado', u['806'].id, { dataHora: new Date('2030-10-29T10:00:00Z'), status: 'realizado' });
    a.desmarcar = await ag('Gestao Desmarcar', u['807'].id, { dataHora: new Date('2030-10-29T11:00:00Z'), emailCompareceu: 'quem.agendou@example.com' });
    a.remarcar = await ag('Gestao Remarcar', u['808'].id, { dataHora: new Date('2030-10-29T13:00:00Z') });
    a.corrida1 = await ag('Gestao Corrida Um', u['809'].id, { dataHora: new Date('2030-10-29T14:00:00Z') });
    a.corrida2 = await ag('Gestao Corrida Dois', u['810'].id, { dataHora: new Date('2030-10-29T15:00:00Z') });
    // horário lotado (o dia 30 tem limite de 1 por hora): ocupa 30/10 09:00
    a.ocupa = await ag('Gestao Ocupa Vaga', u['802'].id, { dataHora: new Date('2030-10-30T09:00:00Z') });
    return { u, a, tipoId: tipo.id, investidorId: inv.id };
  });
}

const contagens = () =>
  comBanco(async (db) => ({
    agendamentos: await db.agendamento.count(),
    presencas: await db.presencaEntrega.count(),
    documentos: await db.documentoAssinado.count(),
    unidades: await db.unidade.count(),
    procuracoes: await db.procuracaoUnidade.count()
  }));

const post = (page, acao, form) => page.request.post(`/admin/quem-agendou?/${acao}`, { form, headers: ACAO });
const texto = async (r) => (await r.text()).replace(/\\u003c/g, '<');

test.beforeAll(async () => {
  d = await criarCenario();
});

test.describe('Alterar, Remarcar e Desmarcar agendamentos', () => {
  test('colaborador não vê os botões e o servidor recusa se ele forçar a chamada', async ({ page }) => {
    await entrarComoAdmin(page, COLABORADOR);
    await page.goto('/admin/quem-agendou?q=Gestao', { waitUntil: 'networkidle' });
    await expect(page.getByText('Gestao Alterar')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Alterar unidade' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Remarcar' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Desmarcar' })).toHaveCount(0);

    const antes = await contagens();
    for (const [acao, form] of [
      ['alterar', { agendamentoId: d.a.alterar.id, unidadeId: d.u['802'].id }],
      ['remarcar', { agendamentoId: d.a.alterar.id, data: '2030-10-29', horario: '16:00' }],
      ['desmarcar', { agendamentoId: d.a.alterar.id, motivo: 'tentativa do colaborador' }]
    ]) {
      const r = await post(page, acao, form);
      expect(r.status(), acao).toBe(403);
    }
    const ag = await comBanco((db) => db.agendamento.findUnique({ where: { id: d.a.alterar.id } }));
    expect(ag).toMatchObject({ status: 'confirmado', unidadeId: d.u['801'].id });
    expect(await contagens()).toEqual(antes);
  });

  test('supervisor ALTERA a unidade pela tela: a antiga fica livre, o aviso dos arquivos aparece e nada é perdido', async ({ page }) => {
    await entrarComoAdmin(page, SUPERVISOR);
    await page.goto('/admin/quem-agendou?q=Gestao Alterar', { waitUntil: 'networkidle' });
    const card = page.locator('div.card', { hasText: 'Gestao Alterar' }).first();
    await card.getByRole('button', { name: 'Alterar unidade' }).click();
    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toContainText('pertencem à unidade antiga');
    // só aparecem unidades que podem ser agendadas: nem estoque, nem outro empreendimento, nem com agendamento ativo
    const opcoes = (await dialogo.locator('#unidadeNova option').allTextContents()).join('|');
    expect(opcoes).toContain('nº 811');
    for (const nao of ['nº 804', 'nº 899', 'nº 803', 'nº 802', 'nº 801']) expect(opcoes, nao).not.toContain(nao);

    const antes = await contagens();
    await dialogo.locator('#unidadeNova').selectOption({ label: 'Bloco 8 - nº 811' });
    await dialogo.getByRole('button', { name: 'Trocar unidade' }).click();
    await expect(page.getByTestId('aviso-acao')).toContainText('Unidade trocada');
    await expect(page.getByTestId('aviso-acao')).toContainText('peça novo envio');
    const id = d.a.alterar.id;
    const ag = await comBanco((db) => db.agendamento.findUnique({ where: { id } }));
    expect(ag).toMatchObject({ unidadeId: d.u['811'].id, unidadeOriginalId: d.u['801'].id, documentoBase64: PNG, procuracaoBase64: PDF }); // arquivos antigos mantidos
    expect(await contagens()).toEqual(antes); // nada criado nem apagado
    // histórico nas duas unidades e log de auditoria com o antes e o depois
    expect(await comBanco((db) => db.historicoUnidade.count({ where: { unidadeId: d.u['801'].id, descricao: { contains: 'transferido' } } }))).toBe(1);
    expect(await comBanco((db) => db.historicoUnidade.count({ where: { unidadeId: d.u['811'].id, descricao: { contains: 'recebido' } } }))).toBe(1);
    const log = await comBanco((db) => db.logAcesso.findFirst({ where: { acao: 'agendamento_unidade_alterada', entidadeId: id } }));
    expect(log.descricao).toContain('de Unidade 801, Bloco 8 para Unidade 811, Bloco 8');
    expect(log.descricao).toContain('Supervisor');
    // a unidade antiga voltou a ficar disponível no agendamento público (e a nova saiu)
    await page.goto('/agendar-entrega-chaves', { waitUntil: 'networkidle' });
    const publico = (await page.locator('#unidadeId option').allTextContents()).join('|');
    expect(publico).toContain('nº 801');
    expect(publico).not.toContain('nº 811');
    // a tela segue avisando para pedir novo envio
    await page.goto('/admin/quem-agendou?q=Gestao Alterar', { waitUntil: 'networkidle' });
    await expect(page.getByTestId('aviso-troca-unidade')).toContainText('peça novo envio');
  });

  test('o servidor aplica as mesmas travas do agendamento público e confere o conflito 1 unidade = 1 agendamento', async ({ page }) => {
    await entrarComoAdmin(page, SUPERVISOR);
    const id = d.a.conflito.id; // está na 803
    const tenta = async (unidadeId) => texto(await post(page, 'alterar', { agendamentoId: id, unidadeId }));
    expect(await tenta(d.u['802'].id)).toContain('já tem agendamento de entrega de chaves'); // conflito (802 tem o "Ocupa Vaga")
    expect(await tenta(d.u['804'].id)).toContain('fora do agendamento'); // estoque
    expect(await tenta(d.u.fora.id)).toContain('não é do empreendimento'); // outro empreendimento
    expect(await tenta(d.u['803'].id)).toContain('já é a unidade');
    expect((await comBanco((db) => db.agendamento.findUnique({ where: { id } }))).unidadeId).toBe(d.u['803'].id); // nada mudou
  });

  test('atendimento iniciado ou realizado bloqueia alterar e remarcar, com o motivo na tela e no servidor', async ({ page }) => {
    await entrarComoAdmin(page, SUPERVISOR);
    await page.goto('/admin/quem-agendou?q=Gestao Iniciado', { waitUntil: 'networkidle' });
    const card = page.locator('div.card', { hasText: 'Gestao Iniciado' }).first();
    await expect(card.getByRole('button', { name: 'Alterar unidade' })).toBeDisabled();
    await expect(card.getByRole('button', { name: 'Remarcar' })).toBeDisabled();
    await expect(card.getByTestId('acoes-bloqueio')).toContainText('o atendimento já foi iniciado');
    const livre = d.u['802'].id;
    expect(await texto(await post(page, 'alterar', { agendamentoId: d.a.iniciado.id, unidadeId: livre }))).toContain('o atendimento já foi iniciado');
    expect(await texto(await post(page, 'remarcar', { agendamentoId: d.a.iniciado.id, data: '2030-10-28', horario: '09:00' }))).toContain('o atendimento já foi iniciado');
    // realizado: nem botões; servidor recusa as três
    await page.goto('/admin/quem-agendou?q=Gestao Realizado', { waitUntil: 'networkidle' });
    await expect(page.locator('div.card', { hasText: 'Gestao Realizado' }).first().getByRole('button', { name: 'Desmarcar' })).toHaveCount(0);
    for (const [acao, form] of [
      ['alterar', { unidadeId: livre }],
      ['remarcar', { data: '2030-10-28', horario: '09:00' }],
      ['desmarcar', { motivo: 'não pode' }]
    ]) {
      expect(await texto(await post(page, acao, { agendamentoId: d.a.realizado.id, ...form })), acao).toContain('já foi realizado');
    }
    // atendimento direto também conta como iniciado
    const direto = await comBanco((db) => db.agendamento.update({ where: { id: d.a.conflito.id }, data: { checkinEm: new Date(), origem: 'atendimento_direto' } }));
    expect(await texto(await post(page, 'remarcar', { agendamentoId: direto.id, data: '2030-10-28', horario: '09:00' }))).toContain('já foi iniciado');
    await comBanco((db) => db.agendamento.update({ where: { id: d.a.conflito.id }, data: { checkinEm: null, origem: 'agendamento' } }));
  });

  test('duplo clique / duas pessoas ao mesmo tempo: só um agendamento ocupa a unidade', async ({ page }) => {
    await entrarComoAdmin(page, SUPERVISOR);
    const livre = d.u['812'];
    const [r1, r2] = await Promise.all([
      post(page, 'alterar', { agendamentoId: d.a.corrida1.id, unidadeId: livre.id }),
      post(page, 'alterar', { agendamentoId: d.a.corrida2.id, unidadeId: livre.id })
    ]);
    const textos = [await texto(r1), await texto(r2)];
    expect(textos.filter((t) => t.includes('Unidade trocada')).length).toBe(1);
    expect(textos.filter((t) => /já tem agendamento|ao mesmo tempo/.test(t)).length).toBe(1);
    expect(await comBanco((db) => db.agendamento.count({ where: { unidadeId: livre.id, status: { not: 'cancelado' } } }))).toBe(1);
  });

  test('REMARCAR: só horários válidos e com vaga; libera a antiga e ocupa a nova', async ({ page }) => {
    await entrarComoAdmin(page, SUPERVISOR);
    const id = d.a.remarcar.id;
    const tenta = async (data, horario) => texto(await post(page, 'remarcar', { agendamentoId: id, data, horario }));
    expect(await tenta('2030-11-05', '10:00')).toContain('não está disponível'); // dia fora da agenda
    expect(await tenta('2030-10-29', '12:30')).toContain('horário não está disponível'); // horário que não existe
    expect(await tenta('2030-10-30', '09:00')).toContain('lotar'); // horário lotado (limite 1 já ocupado)
    expect(await tenta('2030-10-29', '13:00')).toContain('já é o dia e o horário');
    expect((await comBanco((db) => db.agendamento.findUnique({ where: { id } }))).dataHora.toISOString()).toBe('2030-10-29T13:00:00.000Z');

    // pela tela: só aparecem datas abertas e horários com vaga
    await page.goto('/admin/quem-agendou?q=Gestao Remarcar', { waitUntil: 'networkidle' });
    const card = page.locator('div.card', { hasText: 'Gestao Remarcar' }).first();
    await card.getByRole('button', { name: 'Remarcar' }).click();
    const dialogo = page.getByRole('dialog');
    await dialogo.locator('#dataNova').selectOption('2030-10-30');
    const horarios = (await dialogo.locator('#horarioNovo option').allTextContents()).join('|');
    expect(horarios).not.toContain('09:00'); // lotado
    expect(horarios).toContain('10:00');
    await dialogo.locator('#horarioNovo').selectOption('10:00');
    const antes = await contagens();
    await dialogo.getByRole('button', { name: 'Remarcar', exact: true }).click();
    await expect(page.getByTestId('aviso-acao')).toContainText('Remarcado: 29/10/2030 às 13:00 → 30/10/2030 às 10:00');
    expect((await comBanco((db) => db.agendamento.findUnique({ where: { id } }))).dataHora.toISOString()).toBe('2030-10-30T10:00:00.000Z');
    expect(await contagens()).toEqual(antes);
    const log = await comBanco((db) => db.logAcesso.findFirst({ where: { acao: 'agendamento_remarcado', entidadeId: id } }));
    expect(log.descricao).toContain('de 29/10/2030 às 13:00 para 30/10/2030 às 10:00');
    expect(await comBanco((db) => db.historicoUnidade.count({ where: { unidadeId: d.u['808'].id, descricao: { contains: 'remarcado' } } }))).toBe(1);
    // a vaga antiga (29/10 13:00) ficou livre e a nova (30/10 10:00, limite 1) está ocupada
    await page.goto('/agendar-entrega-chaves', { waitUntil: 'networkidle' });
    await page.selectOption('#data', '2030-10-30');
    await expect(page.locator('#horario option', { hasText: '10:00' })).toContainText('(indisponível)');
  });

  test('DESMARCAR: confirmação com unidade, data, hora e quem agendou; motivo obrigatório; nada é apagado', async ({ page }) => {
    await entrarComoAdmin(page, SUPERVISOR);
    await page.goto('/admin/quem-agendou?q=Gestao Desmarcar', { waitUntil: 'networkidle' });
    const card = page.locator('div.card', { hasText: 'Gestao Desmarcar' }).first();
    await card.getByRole('button', { name: 'Desmarcar' }).click();
    const dialogo = page.getByRole('dialog');
    await expect(dialogo.getByTestId('resumo-desmarcar')).toContainText('Bloco 8 - nº 807');
    await expect(dialogo.getByTestId('resumo-desmarcar')).toContainText('29/10/2030 às 11:00');
    await expect(dialogo.getByTestId('resumo-desmarcar')).toContainText('Gestao Desmarcar');
    const confirmar = dialogo.getByRole('button', { name: 'Confirmar: desmarcar' });
    await expect(confirmar).toBeDisabled(); // sem motivo
    // o servidor também exige o motivo
    expect(await texto(await post(page, 'desmarcar', { agendamentoId: d.a.desmarcar.id, motivo: ' ' }))).toContain('Informe o motivo');

    const antes = await contagens();
    await dialogo.locator('#motivo').fill('O cliente pediu para cancelar');
    await confirmar.click();
    await expect(page.getByTestId('aviso-acao')).toContainText('voltou a ficar disponível');
    const ag = await comBanco((db) => db.agendamento.findUnique({ where: { id: d.a.desmarcar.id } }));
    expect(ag).toMatchObject({ status: 'cancelado', motivoCancelamento: 'O cliente pediu para cancelar' });
    expect(ag.canceladoPorId).not.toBeNull();
    expect(ag.canceladoEm).not.toBeNull();
    expect(await contagens()).toEqual(antes); // o registro foi mantido, nada apagado
    const log = await comBanco((db) => db.logAcesso.findFirst({ where: { acao: 'agendamento_desmarcado', entidadeId: ag.id } }));
    expect(log.descricao).toContain('Motivo: O cliente pediu para cancelar');
    expect(log.descricao).toContain('Unidade 807, Bloco 8');
    expect(await comBanco((db) => db.historicoUnidade.count({ where: { unidadeId: d.u['807'].id, descricao: { contains: 'desmarcado' } } }))).toBe(1);
    // desmarcar de novo é recusado
    expect(await texto(await post(page, 'desmarcar', { agendamentoId: ag.id, motivo: 'de novo' }))).toContain('já está cancelado');

    // a unidade volta a aparecer no agendamento público e pode ser agendada de novo
    await page.goto('/agendar-entrega-chaves', { waitUntil: 'networkidle' });
    expect((await page.locator('#unidadeId option').allTextContents()).join('|')).toContain('nº 807');
    const novo = await comBanco((db) => db.agendamento.create({ data: { unidadeId: d.u['807'].id, tipoEventoId: d.tipoId, investidorId: d.investidorId, dataHora: new Date('2030-10-28T16:00:00Z'), qrToken: 'qr-gestao-reagendado', nomeCompareceu: 'Gestao Reagendado' } }));
    expect(novo.id).toBeTruthy(); // o cancelado não conta como "já agendada"
  });

  test('o cancelado é tratado direito: dashboard, lista de entregas, CSVs, lembrete e fluxo', async ({ page }) => {
    await entrarComoAdmin(page, SUPERVISOR);
    // dashboard: aparece à parte, fora das contagens
    await page.goto('/admin/dashboard', { waitUntil: 'networkidle' });
    await expect(page.getByTestId('kpi-cancelados')).toContainText('Desmarcados no período');
    // lista de entregas: cartão marcado, sem botão de iniciar
    await page.goto('/admin/entrega-chaves', { waitUntil: 'networkidle' });
    const cartao = page.locator('div.card', { hasText: 'Gestao Desmarcar' }).filter({ has: page.getByTestId('card-cancelado') }).first();
    await expect(cartao).toContainText('motivo: O cliente pediu para cancelar');
    await expect(cartao.getByRole('link', { name: 'Iniciar entrega' })).toHaveCount(0);
    // CSVs: status, data e motivo
    for (const caminho of ['/admin/quem-agendou/exportar', '/admin/dashboard/exportar']) {
      const csv = (await baixar(page, caminho)).corpo.toString('utf8');
      expect(csv, caminho).toContain('Motivo do cancelamento');
      expect(csv, caminho).toContain('O cliente pediu para cancelar');
    }
    // "ainda não receberam": o cancelado não entra
    await page.goto('/admin/presenca', { waitUntil: 'networkidle' });
    await expect(page.locator('#faltam')).not.toContainText('Gestao Desmarcar');
    // lembrete de véspera: cancelado não gera notificação nem marca como enviado
    const antesNotif = await comBanco((db) => db.notificacao.count());
    await comBanco((db) => db.agendamento.update({ where: { id: d.a.desmarcar.id }, data: { dataHora: new Date(Date.now() + 24 * 3600e3) } }));
    const cron = await page.request.get('/api/cron/lembretes');
    expect(cron.status()).toBe(200);
    expect(await comBanco((db) => db.notificacao.count())).toBe(antesNotif);
    expect((await comBanco((db) => db.agendamento.findUnique({ where: { id: d.a.desmarcar.id } }))).lembreteEnviado).toBe(false);
    // fluxo do atendimento: banner e ações recusadas
    await page.goto(`/admin/entrega-chaves/${d.a.desmarcar.id}`, { waitUntil: 'networkidle' });
    await expect(page.getByTestId('banner-cancelado')).toContainText('Agendamento desmarcado');
    const r = await page.request.post(`/admin/entrega-chaves/${d.a.desmarcar.id}?/salvarObservacoes`, { form: { observacoes: 'não deve gravar' }, headers: ACAO });
    expect(await r.text()).toContain('foi cancelado');
    expect((await comBanco((db) => db.agendamento.findUnique({ where: { id: d.a.desmarcar.id } }))).observacoesAtendimento).toBeNull();
  });

  test.afterAll(async () => {
    // limpeza do que ESTE arquivo criou (só no banco de teste), para não afetar as outras specs
    await comBanco(async (db) => {
      const unidades = await db.unidade.findMany({ where: { bloco: '8', numero: { startsWith: '8' }, compradores: { not: null } }, select: { id: true } });
      const ids = unidades.map((u) => u.id);
      const ags = await db.agendamento.findMany({ where: { unidadeId: { in: ids } }, select: { id: true } });
      await db.logAcesso.deleteMany({ where: { entidadeId: { in: ags.map((a) => a.id) } } });
      await db.historicoUnidade.deleteMany({ where: { unidadeId: { in: ids } } });
      await db.agendamento.deleteMany({ where: { unidadeId: { in: ids } } });
      await db.unidade.deleteMany({ where: { id: { in: ids } } });
      await db.empreendimento.deleteMany({ where: { nome: 'Outro Empreendimento Teste' } });
    });
  });
});
