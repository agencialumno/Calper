import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { gerarPdfModeloVistoria, largurasDasLinhas } from '../../src/lib/server/pdfModeloVistoria.js';
import { dadosDaPreviaVistoria } from '../../src/lib/server/vistoria.js';
import { medirReparos } from '../../src/lib/vistoria.js';

const base = { bloco: '3', unidade: '1204', proprietarios: 'ANA', data: '21 de novembro de 2026', dataCurta: '21/11/2026', reparos: 'Pintura', telefone: '(21) 90000-0000' };

describe('FORM-020 sobre o PDF do modelo', () => {
  it('gera 1 página para ficha e termo, qualquer nº de assinantes', async () => {
    for (const parte of ['ficha', 'termo']) {
      for (const n of [1, 3]) {
        const b64 = await gerarPdfModeloVistoria({ ...base, parte, assinantes: Array.from({ length: n }, (_, i) => ({ nome: `P${i}` })) });
        expect((await PDFDocument.load(Buffer.from(b64, 'base64'))).getPageCount()).toBe(1);
      }
    }
  });
  it('reparos longos continuam em página extra, com a página 1 e as âncoras do modelo', async () => {
    const longo = Array.from({ length: 40 }, (_, i) => `Item ${i + 1}: ${'reparo detalhado do ambiente '.repeat(6)}`).join('\n');
    const b64 = await gerarPdfModeloVistoria({ ...base, parte: 'ficha', reparos: longo, assinantes: [{ nome: 'ANA' }] });
    const pdf = await PDFDocument.load(Buffer.from(b64, 'base64'));
    expect(pdf.getPageCount()).toBeGreaterThan(1);
    const curto = await PDFDocument.load(Buffer.from(await gerarPdfModeloVistoria({ ...base, parte: 'ficha', assinantes: [{ nome: 'ANA' }] }), 'base64'));
    expect(curto.getPageCount()).toBe(1);
    // a página 1 tem o mesmo tamanho do modelo
    expect(pdf.getPage(0).getSize()).toEqual(curto.getPage(0).getSize());
  });
  it('medirReparos avisa quando passa do que cabe na página 1', () => {
    expect(medirReparos('a\nb').cabeNaPagina1).toBe(true);
    expect(medirReparos('linha\n'.repeat(12)).cabeNaPagina1).toBe(false);
    expect(medirReparos('x'.repeat(2000)).cabeNaPagina1).toBe(false);
  });
  it('larguras das linhas diminuem com mais proprietários', () => {
    expect(largurasDasLinhas('ficha', 3).assinante).toBeLessThan(largurasDasLinhas('ficha', 1).assinante);
  });
  it('lê da prévia os campos do modelo (bloco dinâmico)', () => {
    const t = 'FICHA\nObra: Murano Residencial\nBloco: 5 | Unidade: 802\nData: 21/11/2026\nNome do Cliente: ANA\n\nReparos necessários:\nA\nB\n\nTelefone para contato: 99\n\nRio de Janeiro, 21 de novembro de 2026.';
    expect(dadosDaPreviaVistoria(t)).toEqual({ bloco: '5', unidade: '802', proprietarios: 'ANA', dataCurta: '21/11/2026', data: '21 de novembro de 2026', reparos: 'A\nB', telefone: '99' });
  });
});
