import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { gerarPdfModeloVistoria, largurasDasLinhas } from '../../src/lib/server/pdfModeloVistoria.js';
import { dadosDaPreviaVistoria } from '../../src/lib/server/vistoria.js';

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
  it('reparos longos demais viram erro amigável', async () => {
    await expect(gerarPdfModeloVistoria({ ...base, parte: 'ficha', reparos: 'palavra '.repeat(1500), assinantes: [{ nome: 'ANA' }] })).rejects.toMatchObject({ amigavel: true });
  });
  it('larguras das linhas diminuem com mais proprietários', () => {
    expect(largurasDasLinhas('ficha', 3).assinante).toBeLessThan(largurasDasLinhas('ficha', 1).assinante);
  });
  it('lê da prévia os campos do modelo (bloco dinâmico)', () => {
    const t = 'FICHA\nObra: Murano Residencial\nBloco: 5 | Unidade: 802\nData: 21/11/2026\nNome do Cliente: ANA\n\nReparos necessários:\nA\nB\n\nTelefone para contato: 99\n\nRio de Janeiro, 21 de novembro de 2026.';
    expect(dadosDaPreviaVistoria(t)).toEqual({ bloco: '5', unidade: '802', proprietarios: 'ANA', dataCurta: '21/11/2026', data: '21 de novembro de 2026', reparos: 'A\nB', telefone: '99' });
  });
});
