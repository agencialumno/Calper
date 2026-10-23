import { expect, test } from '@playwright/test';
import { DATAS_ABERTAS, DIA_COM_LIMITE_1 } from '../preparar-banco-teste.js';
import { comBanco } from './db.js';

const PDF = { name: 'procuracao.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 teste') };
const PNG = {
  name: 'foto.png',
  mimeType: 'image/png',
  buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
};

async function abrirFormulario(page) {
  await page.goto('/agendar-entrega-chaves', { waitUntil: 'networkidle' });
}

async function preencherBasico(page, { unidade, data, horario, nome }) {
  await page.fill('#nome', nome);
  await page.fill('#cpf', '529.982.247-25');
  await page.fill('#telefone', '(21) 99999-0000');
  await page.fill('#email', 'agendamento.teste@example.com');
  await page.selectOption('#unidadeId', { label: unidade });
  await page.selectOption('#data', data);
  await page.selectOption('#horario', horario);
}

test.describe('agendamento público de entrega de chaves', () => {
  test('o próprio proprietário agenda e a unidade some da lista', async ({ page }) => {
    await abrirFormulario(page);
    const opcoes = await page.locator('#unidadeId option').allTextContents();
    expect(opcoes.join('|')).toContain('105');
    await preencherBasico(page, { unidade: 'Bloco 2 - nº 105', data: DATAS_ABERTAS[0], horario: '14:00', nome: 'Proprietario Teste' });
    await page.check('input[name=ehProprietario][value=sim]');
    await page.click('button:has-text("Confirmar agendamento")');
    await expect(page.getByText('Agendamento realizado com sucesso')).toBeVisible();
    await page.click('button:has-text("Entendi")');

    await abrirFormulario(page);
    expect((await page.locator('#unidadeId option').allTextContents()).join('|')).not.toContain('nº 105');
  });

  test('horário esgotado aparece como "(indisponível)" e não pode ser escolhido', async ({ page }) => {
    // o dia 30 tem limite de 1 por hora: o primeiro agendamento lota o horário
    await abrirFormulario(page);
    await preencherBasico(page, { unidade: 'Bloco 2 - nº 106', data: DIA_COM_LIMITE_1, horario: '09:00', nome: 'Lotacao Um' });
    await page.check('input[name=ehProprietario][value=sim]');
    await page.click('button:has-text("Confirmar agendamento")');
    await expect(page.getByText('Agendamento realizado com sucesso')).toBeVisible();

    await abrirFormulario(page);
    await page.selectOption('#data', DIA_COM_LIMITE_1);
    const opcao = page.locator('#horario option', { hasText: '09:00' });
    await expect(opcao).toContainText('(indisponível)');
    await expect(opcao).toBeDisabled();
  });

  test('quem não é o proprietário precisa da procuração, e só PDF/DOC/DOCX é aceito', async ({ page }) => {
    await abrirFormulario(page);
    await preencherBasico(page, { unidade: 'Bloco 2 - nº 107', data: DATAS_ABERTAS[1], horario: '10:00', nome: 'Procurador Teste' });
    await page.check('input[name=ehProprietario][value=nao]');
    await page.fill('#proprietarioNome', 'Dono Da Unidade');

    // sem procuração: não envia
    await page.click('button:has-text("Confirmar agendamento")');
    await expect(page.getByText('Anexe a procuração para confirmar o agendamento.')).toBeVisible();

    // imagem é recusada com a mensagem certa
    await page.setInputFiles('#procuracao', PNG);
    await expect(page.getByText(/precisa ser um documento: PDF, DOC ou DOCX/)).toBeVisible();

    // PDF vale; mas falta o documento de identidade de quem vai comparecer
    await page.setInputFiles('#procuracao', PDF);
    await page.click('button:has-text("Confirmar agendamento")');
    await expect(page.getByText('Anexe o documento de identidade para confirmar o agendamento.')).toBeVisible();
    // documento que não é foto nem PDF é recusado
    await page.setInputFiles('#identidade', { name: 'identidade.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from('x') });
    await expect(page.getByText(/precisa ser uma foto \(JPG ou PNG\) ou um PDF/)).toBeVisible();

    // foto do documento de identidade vale
    await page.setInputFiles('#identidade', PNG);
    await page.click('button:has-text("Confirmar agendamento")');
    await expect(page.getByText('Agendamento realizado com sucesso')).toBeVisible();
    const ag = await comBanco((db) => db.agendamento.findFirst({ where: { nomeCompareceu: 'Procurador Teste' } }));
    expect(ag.documentoBase64).toMatch(/^data:image\/png;base64,/); // identidade guardada
    expect(ag.procuracaoBase64).toMatch(/^data:application\/pdf/); // procuração continua exigida
  });
});
