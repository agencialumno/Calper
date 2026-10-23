import { expect, test } from '@playwright/test';
import { ADMIN, COLABORADOR, SUPERVISOR } from '../preparar-banco-teste.js';
import { comBanco } from './db.js';
import { entrarComoAdmin } from './helpers.js';

const acao = { 'x-sveltekit-action': 'true', origin: 'http://localhost:5301' };
const idDaUnidade = (numero) => comBanco(async (db) => (await db.unidade.findFirst({ where: { numero } })).id);

// PNG de 1x1 pixel (válido, bem pequeno)
const PNG_PEQUENO = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

test.describe('perfil supervisor', () => {
  test('edita unidades, mas não vê usuários nem logs', async ({ page }) => {
    await entrarComoAdmin(page, SUPERVISOR);
    await page.goto('/admin/unidades', { waitUntil: 'networkidle' });
    await expect(page.getByRole('link', { name: 'Usuários' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Logs' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Questionários' }).first()).toBeVisible();
    for (const caminho of ['/admin/usuarios', '/admin/logs']) {
      const r = await page.request.get(caminho, { maxRedirects: 0 });
      expect(r.status(), caminho).toBe(303);
      expect(r.headers().location).toContain('/admin/sem-acesso');
    }
    // ações das telas de usuários também são barradas
    const bloqueada = await page.request.post('/admin/usuarios?/alterarPerfil', { form: { id: 'x', perfil: 'admin' }, headers: acao });
    expect(bloqueada.status()).toBe(403);

    // altera o status de uma unidade (cartão de status)
    const id = await idDaUnidade('107');
    const r = await page.request.post(`/admin/unidades/${id}/status`, { data: { vistoriaStatus: 'EM REVISTORIA' } });
    expect(r.status()).toBe(200);
    const u = await comBanco((db) => db.unidade.findUnique({ where: { id } }));
    expect(u.vistoriaStatus).toBe('EM REVISTORIA');
    expect(u.vistoriaAprovada).toBe(false); // a vistoria aprovada acompanha o status
    await page.request.post(`/admin/unidades/${id}/status`, { data: { vistoriaStatus: 'APROVADA' } });
  });
});

test.describe('perfil colaborador (somente leitura)', () => {
  test('lê as telas, não vê as abas restritas e não consegue alterar nada', async ({ page }) => {
    await entrarComoAdmin(page, COLABORADOR);
    await page.goto('/admin/unidades', { waitUntil: 'networkidle' });
    for (const nome of ['Questionários', 'Atualizações', 'Empreend.', 'Usuários', 'Logs']) {
      await expect(page.getByRole('link', { name: nome, exact: true }), nome).toHaveCount(0);
    }
    for (const nome of ['Dashboard', 'Unidades', 'Chaves']) {
      await expect(page.getByRole('link', { name: nome, exact: true }).first(), nome).toBeVisible();
    }

    // sem botões de edição no cartão de status e no dossiê
    await expect(page.getByRole('button', { name: 'editar status' })).toHaveCount(0);
    const id = await idDaUnidade('107');
    await page.goto(`/admin/unidades/${id}`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('button', { name: 'editar status' })).toHaveCount(0);
    await expect(page.getByPlaceholder('Adicionar apontamento...')).toHaveCount(0);

    // e o servidor barra mesmo quem tenta por fora da tela
    const status = await page.request.post(`/admin/unidades/${id}/status`, { data: { vistoriaStatus: 'JURÍDICO' } });
    expect(status.status()).toBe(403);
    const doc = await page.request.post('/admin/documentos?/salvarTexto', { form: { tipo: 'checklist', conteudo: 'x' }, headers: acao });
    expect(doc.status()).toBe(403);
    const u = await comBanco((db) => db.unidade.findUnique({ where: { id } }));
    expect(u.vistoriaStatus).toBe('APROVADA');

    // o atendimento presencial continua liberado (observações do atendimento)
    const ag = await comBanco(async (db) => (await db.agendamento.findFirst({ where: { nomeCompareceu: 'Pessoa Compareceu' } })).id);
    const ok = await page.request.post(`/admin/entrega-chaves/${ag}?/salvarObservacoes`, { form: { observacoes: 'Anotação do colaborador' }, headers: acao });
    expect(ok.status()).toBe(200);
    expect((await comBanco((db) => db.agendamento.findUnique({ where: { id: ag } }))).observacoesAtendimento).toBe('Anotação do colaborador');
  });
});

test.describe('admin: usuários e sessões', () => {
  test('altera o perfil de um usuário, mostra quem está online e não deixa rebaixar o próprio admin', async ({ page }) => {
    await entrarComoAdmin(page, ADMIN);
    await page.goto('/admin/usuarios', { waitUntil: 'networkidle' });
    await expect(page.getByText('Colaborador Teste')).toBeVisible();
    // o próprio admin aparece logado agora
    await expect(page.locator('div', { hasText: 'Admin Teste' }).getByText('online agora').first()).toBeVisible();

    const seletor = page.locator('select[aria-label="Perfil de Colaborador Teste"]');
    await seletor.selectOption('supervisor');
    await expect(page.getByText('Colaborador Teste agora é Supervisor.')).toBeVisible();
    expect((await comBanco((db) => db.funcionario.findFirst({ where: { nome: 'Colaborador Teste' } }))).perfil).toBe('supervisor');
    await seletor.selectOption('colaborador'); // volta ao que era
    await expect(page.getByText('Colaborador Teste agora é Colaborador.')).toBeVisible();

    // ninguém rebaixa o próprio perfil (nem fica sem admin)
    await page.locator('select[aria-label="Perfil de Admin Teste"]').selectOption('supervisor');
    await expect(page.getByText(/não pode rebaixar o seu próprio perfil/)).toBeVisible();
    expect((await comBanco((db) => db.funcionario.findFirst({ where: { nome: 'Admin Teste' } }))).perfil).toBe('admin');

    // a alteração de perfil ficou na auditoria
    const logs = await comBanco((db) => db.logAcesso.findMany({ where: { acao: 'perfil_alterado' } }));
    expect(logs.length).toBeGreaterThanOrEqual(2);
  });
});

test.describe('minha conta: senha e foto', () => {
  const CONTA = { email: 'conta.teste@example.com', senha: 'Antiga@12345' };

  test.beforeAll(async () => {
    const { hashSenha } = await import('../../src/lib/server/auth.js');
    await comBanco((db) => db.funcionario.create({ data: { nome: 'Conta Teste', email: CONTA.email, senhaHash: hashSenha(CONTA.senha), perfil: 'colaborador', ativo: true } }));
  });

  test('troca de senha: recusa a senha atual errada e depois entra com a nova', async ({ page }) => {
    await entrarComoAdmin(page, CONTA);
    await page.goto('/admin/conta', { waitUntil: 'networkidle' });

    await page.fill('#senhaAtual', 'Errada@12345');
    await page.fill('#novaSenha', 'Nova@Senha2030');
    await page.fill('#confirmarSenha', 'Nova@Senha2030');
    await page.getByRole('button', { name: 'Trocar senha' }).click();
    await expect(page.getByText('A senha atual está incorreta.')).toBeVisible();

    await page.fill('#senhaAtual', CONTA.senha);
    await page.fill('#novaSenha', 'Nova@Senha2030');
    await page.fill('#confirmarSenha', 'Nova@Senha2030');
    await page.getByRole('button', { name: 'Trocar senha' }).click();
    await expect(page.getByText(/Senha alterada/)).toBeVisible();

    await page.context().clearCookies();
    await entrarComoAdmin(page, { email: CONTA.email, senha: 'Nova@Senha2030' });
    await expect(page).toHaveURL(/\/admin\//);
    CONTA.senha = 'Nova@Senha2030';
  });

  test('foto: recusa arquivo grande e o que não é imagem; aceita imagem pequena', async ({ page }) => {
    await entrarComoAdmin(page, CONTA);
    await page.goto('/admin/conta', { waitUntil: 'networkidle' });

    // grande demais: o navegador avisa na hora e esvazia o campo
    const grande = Buffer.concat([PNG_PEQUENO, Buffer.alloc(3 * 1024 * 1024)]);
    await page.setInputFiles('input[name=foto]', { name: 'grande.png', mimeType: 'image/png', buffer: grande });
    await expect(page.getByText(/o máximo é 2 MB/)).toBeVisible();

    // mesmo burlando o navegador, o servidor recusa e diz o limite
    const r = await page.request.post('/admin/conta?/enviarFoto', {
      multipart: { foto: { name: 'grande.png', mimeType: 'image/png', buffer: grande } },
      headers: acao
    });
    expect(await r.text()).toContain('tamanho máximo é 2 MB');

    // não é imagem (PDF com nome .png): o servidor confere o conteúdo
    await page.setInputFiles('input[name=foto]', { name: 'falsa.png', mimeType: 'image/png', buffer: Buffer.from('%PDF-1.4 não sou imagem') });
    await page.getByRole('button', { name: 'Enviar foto' }).click();
    await expect(page.getByText(/precisa ser uma imagem JPG, PNG ou WEBP/)).toBeVisible();

    // imagem pequena e válida
    await page.setInputFiles('input[name=foto]', { name: 'ok.png', mimeType: 'image/png', buffer: PNG_PEQUENO });
    await page.getByRole('button', { name: 'Enviar foto' }).click();
    await expect(page.locator('img[src^="/admin/foto/"]').first()).toBeVisible();
    const foto = await comBanco(async (db) => db.funcionarioFoto.findFirst({ where: { funcionario: { email: CONTA.email } } }));
    expect(foto.dataUrl).toMatch(/^data:image\/png;base64,/);
  });
});
