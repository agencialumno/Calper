import { expect, test } from '@playwright/test';
import { COLABORADOR, SUPERVISOR } from '../preparar-banco-teste.js';
import { comBanco } from './db.js';
import { baixar, entrarComoAdmin } from './helpers.js';

// Atendimento da vistoria (Bloco 3): quem comparece, resultado (aceita / não aceita), assinantes do termo, revistoria e onde o
// resultado aparece. Roda SÓ no banco de teste (schema calper_test). O DocuSign não é chamado: as variáveis ficam vazias nos
// testes, então o "enviar" devolve o erro de integração e o termo assinado é simulado direto no banco.
const ACAO = { 'x-sveltekit-action': 'true', origin: 'http://localhost:5301' };
const acao = (page, id, nome, form) => page.request.post(`/admin/vistoria/${id}?/${nome}`, { form, headers: ACAO });
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');

test.describe.configure({ mode: 'serial' });

let u; // unidades do Bloco 3 por número
let ag; // agendamentos de vistoria por número da unidade
const DIA_REVISTORIA = '2030-11-06';

async function nova(db, investidorId, tipoEventoId, numero, compradores, extra = {}, agExtra = {}) {
  const murano = await db.empreendimento.findFirst({ where: { nome: { contains: 'Murano', mode: 'insensitive' } } });
  const unidade = await db.unidade.create({
    data: { empreendimentoId: murano.id, bloco: '3', numero, tipologia: '2 QUARTOS', vistoriaStatus: 'EM REVISTORIA', vistoriaAprovada: false, compradores, ...extra }
  });
  const agendamento = await db.agendamento.create({
    data: {
      unidadeId: unidade.id, tipoEventoId, investidorId, dataHora: new Date('2030-11-04T10:00:00Z'), qrToken: `qr-vist-${numero}`,
      nomeCompareceu: `Agendou ${numero}`, cpfCompareceu: '52998224725', telefoneCompareceu: '21999990000', emailCompareceu: `agendou${numero}@example.com`, ehProprietario: true, ...agExtra
    }
  });
  return { unidade, agendamento };
}

test.beforeAll(async () => {
  const r = await comBanco(async (db) => {
    const tipo = await db.tipoEvento.findUnique({ where: { slug: 'vistoria' } });
    const inv = await db.investidor.findFirst({ where: { cpf: '11144477735' } });
    const par = (nome, principal) => ({ nome, principal });
    const out = {};
    out['701'] = await nova(db, inv.id, tipo.id, '701', [par('ANA DOIS COMPRADORES', true), par('BIA DOIS COMPRADORES', false)]);
    out['702'] = await nova(db, inv.id, tipo.id, '702', [par('CARLA COM PROCURADOR', true)]);
    out['703'] = await nova(db, inv.id, tipo.id, '703', []); // sem comprador cadastrado
    out['704'] = await nova(db, inv.id, tipo.id, '704', [par('DIOGO NAO ACEITA', true)]);
    out['705'] = await nova(db, inv.id, tipo.id, '705', [par('EVA ACEITA', true)]);
    out['706'] = await nova(db, inv.id, tipo.id, '706', [par('FABIO REVISTORIA', true)]);
    out['707'] = await nova(db, inv.id, tipo.id, '707', [par('GILDA REVISTORIA', true)]);
    out['708'] = await nova(db, inv.id, tipo.id, '708', [par('HUGO PERMISSAO', true)]);
    out['709'] = await nova(db, inv.id, tipo.id, '709', [par('IVO FLUXO COMPLETO', true)]);
    await db.agendaDiaVistoria.create({ data: { data: DIA_REVISTORIA, aberto: true, limitePorHora: 1 } });
    return out;
  });
  u = Object.fromEntries(Object.entries(r).map(([n, x]) => [n, x.unidade]));
  ag = Object.fromEntries(Object.entries(r).map(([n, x]) => [n, x.agendamento]));
});

/** Etapa 1 pela tela: marca os compradores (índice na lista da unidade) e/ou o procurador e confirma. */
async function registrarPresentes(page, id, { compradores = [], procurador = null } = {}) {
  await page.goto(`/admin/vistoria/${id}?passo=1`, { waitUntil: 'networkidle' });
  for (const { indice, email } of compradores) {
    await page.locator(`input[name=presente][value=c${indice}]`).check();
    await page.locator(`input[name=email_c${indice}]`).fill(email);
  }
  if (procurador) {
    await page.locator('input[name=procurador]').check();
    await page.fill('#procNome', procurador.nome);
    await page.fill('#procCpf', procurador.cpf ?? '529.982.247-25');
    await page.fill('#procEmail', procurador.email);
    if (procurador.arquivo !== false) await page.setInputFiles('#procuracao', { name: 'procuracao.pdf', mimeType: 'application/pdf', buffer: PDF });
  }
  await page.getByRole('button', { name: 'Confirmar e continuar' }).click();
}

async function resultadoAceita(page, id) {
  await page.goto(`/admin/vistoria/${id}?passo=3`, { waitUntil: 'networkidle' });
  await page.locator('input[name=resultado][value=aceita]').check();
  await page.getByRole('button', { name: 'Registrar resultado' }).click();
  await expect(page).toHaveURL(/passo=4/);
}

test.describe('aba Vistoria: Iniciar atendimento', () => {
  test('cada card tem "Iniciar atendimento" e abre o atendimento da vistoria', async ({ page }) => {
    await entrarComoAdmin(page);
    await page.goto('/admin/vistoria', { waitUntil: 'networkidle' });
    // o servidor de desenvolvimento compila a rota na primeira visita: aquece antes de clicar
    await page.request.get(`/admin/vistoria/${ag['701'].id}`, { timeout: 280_000 });
    const card = page.getByTestId('card-vistoria').filter({ hasText: 'Bloco 3 - nº 701' });
    await expect(card.getByTestId('iniciar-atendimento-vistoria')).toHaveText('Iniciar atendimento');
    await card.getByTestId('iniciar-atendimento-vistoria').click();
    await expect(page).toHaveURL(new RegExp(`/admin/vistoria/${ag['701'].id}$`));
    await expect(page.getByRole('heading', { name: 'Bloco 3 - nº 701' })).toBeVisible();
    for (const etapa of ['1. Quem comparece', '2. Vistoria', '3. Resultado', '4. Termo', '5. Concluído']) await expect(page.getByRole('link', { name: etapa })).toBeVisible();
  });

  test('o atendimento da entrega de chaves não abre agendamento de vistoria (e vice-versa)', async ({ page }) => {
    await entrarComoAdmin(page);
    expect((await page.request.get(`/admin/entrega-chaves/${ag['701'].id}`)).status()).toBe(404);
  });
});

test.describe('quem comparece e quem assina o termo', () => {
  test('sem ninguém marcado: recusa; etapas seguintes bloqueadas', async ({ page }) => {
    await entrarComoAdmin(page);
    await page.goto(`/admin/vistoria/${ag['701'].id}?passo=1`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Confirmar e continuar' }).click();
    await expect(page.getByText('Marque quem comparece')).toBeVisible();
    for (const passo of [2, 3, 4]) {
      await page.goto(`/admin/vistoria/${ag['701'].id}?passo=${passo}`, { waitUntil: 'networkidle' });
      await expect(page.getByTestId('etapa-bloqueada')).toBeVisible();
    }
    expect((await comBanco((db) => db.agendamento.findUnique({ where: { id: ag['701'].id } }))).vistoriaPresentes).toBeNull();
  });

  test('procurador sem procuração: recusa (mesma regra da entrega)', async ({ page }) => {
    await entrarComoAdmin(page);
    await registrarPresentes(page, ag['702'].id, { procurador: { nome: 'Pedro Procurador', email: 'pedro@example.com', arquivo: false } });
    await expect(page.getByText('Procurador comparece: envie a procuração para continuar.')).toBeVisible();
    expect((await comBanco((db) => db.agendamento.findUnique({ where: { id: ag['702'].id } }))).vistoriaPresentes).toBeNull();
  });

  test('todos os compradores presentes assinam; o representante da Calper é o funcionário logado', async ({ page }) => {
    await entrarComoAdmin(page, SUPERVISOR);
    await registrarPresentes(page, ag['701'].id, {
      compradores: [{ indice: 0, email: 'ana@example.com' }, { indice: 1, email: 'bia@example.com' }]
    });
    await expect(page).toHaveURL(/passo=2/);
    await resultadoAceita(page, ag['701'].id);
    await expect(page.getByTestId('assina-calper')).toHaveText('Supervisor Teste');
    await expect(page.getByTestId('quem-assina')).toContainText(SUPERVISOR.email);
    await expect(page.getByTestId('assinante')).toHaveCount(2);
    await expect(page.getByTestId('assinante').nth(0)).toContainText('ANA DOIS COMPRADORES');
    await expect(page.getByTestId('assinante').nth(0)).toContainText('ana@example.com');
    await expect(page.getByTestId('assinante').nth(1)).toContainText('BIA DOIS COMPRADORES');
    // o texto montado traz uma linha de assinatura por proprietário e a do representante (funcionário logado)
    const texto = await page.locator('textarea[name=texto]').inputValue();
    expect(texto).toContain('[ASSINATURA PROPRIETÁRIO 1: ANA DOIS COMPRADORES]');
    expect(texto).toContain('[ASSINATURA PROPRIETÁRIO 2: BIA DOIS COMPRADORES]');
    expect(texto).toContain('[ASSINATURA REPRESENTANTE DA CALPER: Supervisor Teste]');
    expect(texto).toContain('Bloco: 3 | Unidade: 701');
    expect(texto).toContain('TERMO DE RECEBIMENTO DO IMÓVEL');
    expect(texto).not.toMatch(/\{\{\w+\}\}/);
  });

  test('comprador + procurador: o procurador também assina', async ({ page }) => {
    await entrarComoAdmin(page);
    await registrarPresentes(page, ag['702'].id, {
      compradores: [{ indice: 0, email: 'carla@example.com' }],
      procurador: { nome: 'Pedro Procurador', email: 'pedro@example.com' }
    });
    await expect(page).toHaveURL(/passo=2/);
    await resultadoAceita(page, ag['702'].id);
    await expect(page.getByTestId('assina-calper')).toHaveText('Admin Teste');
    await expect(page.getByTestId('assinante')).toHaveCount(2);
    await expect(page.getByTestId('assinante').nth(0)).toContainText('CARLA COM PROCURADOR');
    await expect(page.getByTestId('assinante').nth(1)).toContainText('Pedro Procurador');
    const texto = await page.locator('textarea[name=texto]').inputValue();
    expect(texto).toContain('neste ato representado por Pedro Procurador');
    expect(texto).toContain('[ASSINATURA PROCURADOR 2: Pedro Procurador]');
    const salvo = await comBanco((db) => db.agendamento.findUnique({ where: { id: ag['702'].id } }));
    expect(salvo.vistoriaPresentes.map((p) => p.vinculo)).toEqual(['comprador_principal', 'procurador']);
    expect(salvo.procuracaoBase64).toContain('application/pdf');
    expect(await comBanco((db) => db.procuracaoUnidade.count({ where: { unidadeId: u['702'].id } }))).toBe(1);
  });

  test('nenhum comprador presente: o procurador com procuração assina sozinho', async ({ page }) => {
    await entrarComoAdmin(page, COLABORADOR);
    await registrarPresentes(page, ag['703'].id, { procurador: { nome: 'Paulo Sozinho', email: 'paulo@example.com' } });
    await expect(page).toHaveURL(/passo=2/);
    await resultadoAceita(page, ag['703'].id);
    await expect(page.getByTestId('assina-calper')).toHaveText('Colaborador Teste');
    await expect(page.getByTestId('assinante')).toHaveCount(1);
    await expect(page.getByTestId('assinante')).toContainText('Paulo Sozinho');
    await expect(page.getByTestId('assinante')).toContainText('Procurador');
    const texto = await page.locator('textarea[name=texto]').inputValue();
    expect(texto).toContain('na qualidade de procurador');
  });

  test('sem comprador e sem procurador com procuração: o avanço é bloqueado (servidor também recusa o resultado)', async ({ page }) => {
    await entrarComoAdmin(page);
    // 704 não tem ninguém registrado: nem a etapa 4 abre, nem o servidor aceita o resultado
    await page.goto(`/admin/vistoria/${ag['704'].id}?passo=4`, { waitUntil: 'networkidle' });
    await expect(page.getByTestId('etapa-bloqueada')).toContainText('Marque quem comparece');
    const r = await acao(page, ag['704'].id, 'registrarResultado', { resultado: 'aceita' });
    expect(await r.text()).toContain('Registre quem comparece');
    expect((await comBanco((db) => db.agendamento.findUnique({ where: { id: ag['704'].id } }))).vistoriaResultado).toBeNull();
    // procurador gravado sem procuração válida (dado inconsistente) também bloqueia
    await comBanco((db) => db.agendamento.update({ where: { id: ag['704'].id }, data: { vistoriaPresentes: [{ nome: 'Sem Procuracao', cpf: '52998224725', email: 's@example.com', vinculo: 'procurador' }] } }));
    await page.goto(`/admin/vistoria/${ag['704'].id}?passo=4`, { waitUntil: 'networkidle' });
    await expect(page.getByTestId('etapa-bloqueada')).toContainText('anexe a procuração');
    await comBanco((db) => db.agendamento.update({ where: { id: ag['704'].id }, data: { vistoriaPresentes: [] } }));
  });

  test('falta e-mail de um comprador marcado: o termo não abre', async ({ page }) => {
    await entrarComoAdmin(page);
    await registrarPresentes(page, ag['708'].id, { compradores: [{ indice: 0, email: '' }] });
    await expect(page).toHaveURL(/passo=2/);
    await resultadoAceita(page, ag['708'].id);
    await expect(page.getByTestId('etapa-bloqueada')).toContainText('Informe o e-mail de HUGO PERMISSAO');
  });

  test('enviar sem DocuSign configurado devolve o erro e não cria documento nem conclui a vistoria', async ({ page }) => {
    await entrarComoAdmin(page);
    await page.goto(`/admin/vistoria/${ag['701'].id}?passo=4`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Cliente: ler o documento' }).waitFor();
    const texto = await page.locator('textarea[name=texto]').inputValue();
    const r = await acao(page, ag['701'].id, 'enviar', { texto });
    expect(await r.text()).toContain('Não foi possível enviar para assinatura');
    expect(await comBanco((db) => db.documentoAssinado.count({ where: { agendamentoId: ag['701'].id } }))).toBe(0);
    expect((await comBanco((db) => db.agendamento.findUnique({ where: { id: ag['701'].id } }))).status).toBe('confirmado');
    // a prévia (PDF) funciona
    const previa = await acao(page, ag['701'].id, 'previa', { texto });
    expect(await previa.text()).toContain('pdfBase64');
  });
});

test.describe('vistoria não aceita', () => {
  test('reparos e telefone são obrigatórios; sem documento; status "Vistoria não aceita"; unidade intacta', async ({ page }) => {
    await entrarComoAdmin(page);
    await registrarPresentes(page, ag['704'].id, { compradores: [{ indice: 0, email: 'diogo@example.com' }] });
    await expect(page).toHaveURL(/passo=2/);

    // servidor recusa sem reparos / sem telefone
    const semReparos = await acao(page, ag['704'].id, 'registrarResultado', { resultado: 'nao_aceita', reparos: '', telefoneRetorno: '(21) 98888-7777' });
    expect(await semReparos.text()).toContain('Descreva os reparos');
    const semTelefone = await acao(page, ag['704'].id, 'registrarResultado', { resultado: 'nao_aceita', reparos: 'Pintura da sala', telefoneRetorno: '' });
    expect(await semTelefone.text()).toContain('telefone');
    expect((await comBanco((db) => db.agendamento.findUnique({ where: { id: ag['704'].id } }))).vistoriaResultado).toBeNull();

    await page.goto(`/admin/vistoria/${ag['704'].id}?passo=3`, { waitUntil: 'networkidle' });
    await page.locator('input[name=resultado][value=nao_aceita]').check();
    await page.fill('#reparos', 'Rejunte do banheiro solto\nPorta da varanda arranhada');
    await page.fill('#telefoneRetorno', '(21) 98888-7777');
    await page.getByRole('button', { name: 'Registrar resultado' }).click();
    await expect(page).toHaveURL(/passo=5/);
    await expect(page.getByTestId('resultado-vistoria')).toHaveText('Vistoria não aceita');
    await expect(page.getByTestId('reparos-registrados')).toContainText('Rejunte do banheiro solto');

    const a = await comBanco((db) => db.agendamento.findUnique({ where: { id: ag['704'].id } }));
    expect(a.vistoriaResultado).toBe('nao_aceita');
    expect(a.status).toBe('realizado');
    expect(a.vistoriaTelefoneRetorno).toBe('(21) 98888-7777');
    expect(a.vistoriaConcluidaEm).not.toBeNull();
    // sem documento e sem assinatura
    expect(await comBanco((db) => db.documentoAssinado.count({ where: { agendamentoId: ag['704'].id } }))).toBe(0);
    await page.goto(`/admin/vistoria/${ag['704'].id}?passo=4`, { waitUntil: 'networkidle' });
    await expect(page.getByTestId('etapa-bloqueada')).toContainText('não há documento nem assinatura');
    const enviar = await acao(page, ag['704'].id, 'enviar', { texto: 'x' });
    expect(await enviar.text()).toContain('O termo só existe para vistoria aceita');
    // a vistoria concluída não é mais alterada
    const outra = await acao(page, ag['704'].id, 'registrarResultado', { resultado: 'aceita' });
    expect(await outra.text()).toContain('já foi concluída');
    // status da vistoria é derivado do agendamento: a unidade não foi alterada
    const un = await comBanco((db) => db.unidade.findUnique({ where: { id: u['704'].id } }));
    expect(un.vistoriaStatus).toBe('EM REVISTORIA');
    expect(un.vistoriaAprovada).toBe(false);
  });
});

test.describe('revistoria', () => {
  test('só depois de "não aceita": numa vistoria sem resultado ou aceita, o servidor recusa', async ({ page }) => {
    await entrarComoAdmin(page);
    const r = await acao(page, ag['706'].id, 'abrirRevistoria', { quando: 'agora' });
    expect(await r.text()).toContain('a revistoria só abre depois de uma vistoria não aceita');
    expect(await comBanco((db) => db.agendamento.count({ where: { unidadeId: u['706'].id } }))).toBe(1);
  });

  test('colaborador não abre a revistoria (nem vê o botão); supervisor abre "agora" com vistoriaNumero + 1', async ({ page }) => {
    // 704 já está "não aceita"
    await entrarComoAdmin(page, COLABORADOR);
    await page.goto(`/admin/vistoria/${ag['704'].id}?passo=5`, { waitUntil: 'networkidle' });
    await expect(page.getByTestId('revistoria-sem-permissao')).toBeVisible();
    await expect(page.getByTestId('form-revistoria')).toHaveCount(0);
    const negada = await acao(page, ag['704'].id, 'abrirRevistoria', { quando: 'agora' });
    expect(await negada.text()).toContain('Só admin e supervisor abrem a revistoria');
    expect(await comBanco((db) => db.agendamento.count({ where: { unidadeId: u['704'].id } }))).toBe(1);

    await page.context().clearCookies();
    await entrarComoAdmin(page, SUPERVISOR);
    await page.goto(`/admin/vistoria/${ag['704'].id}?passo=5`, { waitUntil: 'networkidle' });
    await page.locator('input[name=quando][value=agora]').check();
    await page.getByRole('button', { name: /Abrir revistoria \(2ª vistoria\)/ }).click();
    await expect(page).toHaveURL(/\/admin\/vistoria\/[a-z0-9]+\?passo=1/);
    const todas = await comBanco((db) => db.agendamento.findMany({ where: { unidadeId: u['704'].id }, orderBy: { vistoriaNumero: 'asc' } }));
    expect(todas.map((a) => a.vistoriaNumero)).toEqual([1, 2]);
    expect(todas[1].origem).toBe('atendimento_direto');
    expect(todas[1].checkinEm).not.toBeNull();
    expect(todas[1].status).toBe('confirmado');
    await expect(page.getByText('2ª vistoria').first()).toBeVisible();

    // só uma revistoria aberta por vez
    const outra = await acao(page, ag['704'].id, 'abrirRevistoria', { quando: 'agora' });
    expect(await outra.text()).toContain('já existe uma revistoria aberta');
    expect(await comBanco((db) => db.agendamento.count({ where: { unidadeId: u['704'].id } }))).toBe(2);
  });

  test('admin escolhe data e horário na agenda de vistoria, respeitando as vagas', async ({ page }) => {
    await comBanco((db) =>
      db.agendamento.update({ where: { id: ag['706'].id }, data: { vistoriaResultado: 'nao_aceita', vistoriaReparos: 'Tomada solta', vistoriaTelefoneRetorno: '21977776666', status: 'realizado', vistoriaPresentes: [{ nome: 'FABIO REVISTORIA', email: 'f@example.com', vinculo: 'comprador_principal' }] } })
    );
    await comBanco((db) =>
      db.agendamento.update({ where: { id: ag['707'].id }, data: { vistoriaResultado: 'nao_aceita', vistoriaReparos: 'Janela', vistoriaTelefoneRetorno: '21977776666', status: 'realizado', vistoriaPresentes: [{ nome: 'GILDA REVISTORIA', email: 'g@example.com', vinculo: 'comprador_principal' }] } })
    );
    await entrarComoAdmin(page);
    await page.goto(`/admin/vistoria/${ag['706'].id}?passo=5`, { waitUntil: 'networkidle' });
    await page.locator('input[name=quando][value=agenda]').check();
    await page.selectOption('select[name=data]', DIA_REVISTORIA);
    await page.selectOption('select[name=horario]', '09:00');
    await page.getByRole('button', { name: /Abrir revistoria/ }).click();
    await expect(page).toHaveURL(/passo=1/);
    const nova2 = await comBanco((db) => db.agendamento.findFirst({ where: { unidadeId: u['706'].id, vistoriaNumero: 2 } }));
    expect(nova2.dataHora.toISOString()).toBe(`${DIA_REVISTORIA}T09:00:00.000Z`);
    expect(nova2.origem).toBe('agendamento');

    // o horário tem 1 vaga: a revistoria de outra unidade no mesmo horário é recusada pelo servidor
    const lotado = await acao(page, ag['707'].id, 'abrirRevistoria', { quando: 'agenda', data: DIA_REVISTORIA, horario: '09:00' });
    expect(await lotado.text()).toContain('acabou de lotar');
    expect(await comBanco((db) => db.agendamento.count({ where: { unidadeId: u['707'].id } }))).toBe(1);
    // e a tela não oferece mais o horário lotado
    await page.goto(`/admin/vistoria/${ag['707'].id}?passo=5`, { waitUntil: 'networkidle' });
    await page.locator('input[name=quando][value=agenda]').check();
    await page.selectOption('select[name=data]', DIA_REVISTORIA);
    expect(await page.locator('select[name=horario] option').allTextContents()).not.toContain('09:00 (0 vaga)');
    expect((await page.locator('select[name=horario] option').allTextContents()).some((t) => t.startsWith('09:00'))).toBe(false);
  });
});

test.describe('não aceita → revistoria (fluxo completo pela tela)', () => {
  test('não aceita grava no histórico; a revistoria aparece como tal e puxa reparos e observações, só para leitura', async ({ page }) => {
    await entrarComoAdmin(page, SUPERVISOR);
    const id = ag['709'].id;
    await registrarPresentes(page, id, { compradores: [{ indice: 0, email: 'ivo@example.com' }] });
    await expect(page).toHaveURL(/passo=2/, { timeout: 60_000 });
    await page.fill('#observacoes', 'Piso da sala com risco');
    await page.getByRole('button', { name: 'Salvar observações' }).click();
    await expect(page.getByText('Observações salvas.')).toBeVisible();
    await page.goto(`/admin/vistoria/${id}?passo=3`, { waitUntil: 'networkidle' });
    await page.locator('input[name=resultado][value=nao_aceita]').check();
    await page.fill('textarea[name=reparos]', 'Trocar a tomada da cozinha e pintar o teto do quarto');
    await page.fill('input[name=telefoneRetorno]', '(21) 98888-7777');
    await page.getByRole('button', { name: 'Registrar resultado' }).click();
    await expect(page).toHaveURL(/passo=5/, { timeout: 60_000 });

    // a) fecha o atendimento e grava no histórico: resultado, reparos, telefone e quem atendeu
    const fechado = await comBanco((db) => db.agendamento.findUnique({ where: { id } }));
    expect(fechado.status).toBe('realizado');
    expect(fechado.vistoriaResultado).toBe('nao_aceita');
    const h1 = await comBanco((db) => db.historicoUnidade.findMany({ where: { unidadeId: u['709'].id, tipo: 'apontamento' } }));
    expect(h1).toHaveLength(1);
    expect(h1[0].descricao).toContain('Vistoria 1 não aceita');
    expect(h1[0].descricao).toContain('Trocar a tomada da cozinha');
    expect(h1[0].descricao).toContain('(21) 98888-7777');
    expect(h1[0].descricao).toContain('Atendido por: Supervisor Teste');
    expect(h1[0].criadoPorId).not.toBeNull();

    // abre a revistoria (2ª vistoria)
    await page.locator('input[name=quando][value=agora]').check();
    await page.getByRole('button', { name: /Abrir revistoria \(2ª vistoria\)/ }).click();
    await expect(page).toHaveURL(/passo=1/, { timeout: 60_000 });
    const nova2 = await comBanco((db) => db.agendamento.findFirst({ where: { unidadeId: u['709'].id, vistoriaNumero: 2 } }));
    expect(nova2).not.toBeNull();

    // c) passo 2 da revistoria: reparos e observações anteriores em destaque, só leitura
    await registrarPresentes(page, nova2.id, { compradores: [{ indice: 0, email: 'ivo@example.com' }] });
    await expect(page).toHaveURL(/passo=2/, { timeout: 60_000 });
    const destaque = page.getByTestId('vistoria-anterior');
    await expect(destaque).toBeVisible();
    await expect(page.getByTestId('reparos-anteriores')).toHaveText('Trocar a tomada da cozinha e pintar o teto do quarto');
    await expect(page.getByTestId('observacoes-anteriores')).toHaveText('Piso da sala com risco');
    await expect(destaque.locator('textarea, input')).toHaveCount(0);
    await expect(page.locator('#observacoes')).toHaveValue(''); // o campo editável é só o da revistoria
    // a 1ª vistoria não mostra o destaque
    await page.goto(`/admin/vistoria/${id}?passo=2`, { waitUntil: 'networkidle' });
    await expect(page.getByTestId('vistoria-anterior')).toHaveCount(0);

    // b) aparece como "Revistoria" no histórico/dossiê da unidade, em Quem agendou e na aba Vistoria
    await page.goto(`/admin/unidades/${u['709'].id}`, { waitUntil: 'networkidle' });
    await expect(page.getByText('Revistoria (2ª vistoria) aberta')).toBeVisible();
    await expect(page.getByText(/Vistoria 1 não aceita\. Reparos: Trocar a tomada/)).toBeVisible();
    await expect(page.getByTestId('secao-vistorias')).toContainText('Revistoria · 2ª vistoria');
    await page.goto('/admin/quem-agendou', { waitUntil: 'networkidle' });
    await expect(page.getByText('revistoria 2').first()).toBeVisible();
    await page.goto('/admin/vistoria', { waitUntil: 'networkidle' });
    await expect(page.getByTestId('card-vistoria').filter({ hasText: 'Bloco 3 - nº 709' }).filter({ hasText: 'Revistoria · 2ª vistoria' })).toHaveCount(1);
  });
});

test.describe('onde o resultado aparece', () => {
  test('vistoria aceita (termo assinado): lista, resumo, download, quem agendou, CSVs, dashboard e dossiê', async ({ page }) => {
    await comBanco(async (db) => {
      await db.agendamento.update({
        where: { id: ag['705'].id },
        data: {
          status: 'realizado', vistoriaResultado: 'aceita', vistoriaConcluidaEm: new Date(), dataHora: new Date(Date.now() - 6 * 3600 * 1000),
          vistoriaPresentes: [{ nome: 'EVA ACEITA', email: 'eva@example.com', vinculo: 'comprador_principal' }]
        }
      });
      await db.documentoAssinado.create({
        data: { agendamentoId: ag['705'].id, unidadeId: u['705'].id, tipo: 'termo_vistoria', status: 'assinado', pdfBase64: `data:application/pdf;base64,${PDF.toString('base64')}`, docusignEnvelopeId: 'env-vist-teste', assinadoEm: new Date() }
      });
    });
    // a 1ª vistoria da 704 (não aceita) tem que cair no período do dashboard
    await comBanco((db) => db.agendamento.update({ where: { id: ag['704'].id }, data: { dataHora: new Date(Date.now() - 7 * 3600 * 1000) } }));
    await entrarComoAdmin(page);

    // lista: etiqueta do resultado e botão que abre direto o resumo
    await page.goto('/admin/vistoria', { waitUntil: 'networkidle' });
    const card = page.getByTestId('card-vistoria').filter({ hasText: 'Bloco 3 - nº 705' });
    await expect(card.getByTestId('resultado-card')).toHaveText('Vistoria aceita');
    await card.getByTestId('iniciar-atendimento-vistoria').click();
    await expect(page).toHaveURL(/passo=5/);
    // resumo final
    await expect(page.getByTestId('resumo-vistoria')).toContainText('Vistoria aceita');
    await expect(page.getByTestId('resumo-vistoria')).toContainText('EVA ACEITA');
    await expect(page.getByTestId('resumo-vistoria')).toContainText('Assinado por todos');
    const pdf = await baixar(page, `/admin/vistoria/${ag['705'].id}/documento`);
    expect(pdf.status).toBe(200);
    expect(pdf.tipo).toContain('application/pdf');

    // Quem agendou: coluna Serviço com o resultado (e o CSV do mesmo filtro)
    await page.goto('/admin/quem-agendou?servico=vistoria', { waitUntil: 'networkidle' });
    const linha = page.locator('div.card', { hasText: 'Agendou 705' });
    await expect(linha.getByTestId('selo-servico')).toContainText('Vistoria');
    await expect(linha.getByTestId('resultado-vistoria')).toHaveText('Vistoria aceita');
    const csvQuem = (await baixar(page, '/admin/quem-agendou/exportar?servico=vistoria')).corpo.toString('utf8');
    expect(csvQuem).toContain('Resultado da vistoria');
    expect(csvQuem).toMatch(/Agendou 705[^\r\n]*/);
    const linhaQuem = csvQuem.split('\r\n').find((l) => l.includes('Agendou 705'));
    expect(linhaQuem).toContain('Vistoria aceita');
    // o CSV padrão (entrega de chaves) não ganhou coluna
    const csvPadrao = (await baixar(page, '/admin/quem-agendou/exportar')).corpo.toString('utf8');
    expect(csvPadrao).not.toContain('Resultado da vistoria');

    // CSV das vistorias
    const csv = (await baixar(page, '/admin/vistoria/exportar')).corpo.toString('utf8');
    const cab = csv.split('\r\n')[0];
    expect(cab).toContain('Resultado da vistoria');
    expect(cab).toContain('Reparos');
    const l705 = csv.split('\r\n').find((l) => l.includes('"3";"705";"1"'));
    expect(l705).toContain('Vistoria aceita');
    expect(l705).toContain('EVA ACEITA (comprador principal)');
    expect(l705).toContain('"assinado"');
    const l704 = csv.split('\r\n').find((l) => l.includes('"3";"704";"1"'));
    expect(l704).toContain('Vistoria não aceita');
    expect(l704).toContain('Rejunte do banheiro solto');
    expect(l704).toContain('(21) 98888-7777');
    expect(l704).toContain('sem documento');

    // dashboard
    await page.goto('/admin/dashboard', { waitUntil: 'networkidle' });
    expect(Number(await page.getByTestId('kpi-vistorias-aceitas').innerText())).toBeGreaterThanOrEqual(1);
    expect(Number(await page.getByTestId('kpi-vistorias-nao-aceitas').innerText())).toBeGreaterThanOrEqual(1);

    // dossiê: seção Vistorias
    await page.goto(`/admin/unidades/${u['705'].id}`, { waitUntil: 'networkidle' });
    const sec = page.getByTestId('secao-vistorias');
    await expect(sec).toContainText('1ª vistoria');
    await expect(sec).toContainText('Vistoria aceita');
    await expect(sec).toContainText('Baixar termo assinado');
    await page.goto(`/admin/unidades/${u['704'].id}`, { waitUntil: 'networkidle' });
    const sec4 = page.getByTestId('secao-vistorias');
    await expect(sec4).toContainText('Vistoria não aceita');
    await expect(sec4).toContainText('Rejunte do banheiro solto');
    await expect(sec4.getByTestId('vistoria-item')).toHaveCount(2); // 1ª (não aceita) e a revistoria aberta
  });

  test('aceita ainda sem termo assinado não conta como aceita', async ({ page }) => {
    await entrarComoAdmin(page);
    // 702 / 701 / 703 têm resultado "aceita" mas o termo não foi assinado
    await page.goto('/admin/vistoria', { waitUntil: 'networkidle' });
    const card = page.getByTestId('card-vistoria').filter({ hasText: 'Bloco 3 - nº 702' });
    await expect(card.getByTestId('resultado-card')).toContainText('aguardando assinatura do termo');
  });
});

// Limpa o que este arquivo criou no BANCO DE TESTE (schema calper_test): os testes seguintes (ex.: importação) contam unidades.
test.afterAll(async () => {
  await comBanco(async (db) => {
    const unidadeIds = Object.values(u ?? {}).map((x) => x.id);
    if (unidadeIds.length === 0) return;
    await db.documentoAssinado.deleteMany({ where: { unidadeId: { in: unidadeIds } } });
    await db.procuracaoUnidade.deleteMany({ where: { unidadeId: { in: unidadeIds } } });
    await db.agendamento.deleteMany({ where: { unidadeId: { in: unidadeIds } } });
    await db.historicoUnidade.deleteMany({ where: { unidadeId: { in: unidadeIds } } });
    await db.unidade.deleteMany({ where: { id: { in: unidadeIds } } });
    await db.agendaDiaVistoria.deleteMany({ where: { data: DIA_REVISTORIA } });
  });
});
