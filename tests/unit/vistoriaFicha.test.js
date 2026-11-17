import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { ajustarAssinaturasVistoria, linhasDeAssinatura } from '../../src/lib/server/vistoria.js';
import { gerarPdfVistoria } from '../../src/lib/server/pdfVistoria.js';

const quem = [{ nome: 'ANA', vinculo: 'comprador_principal' }, { nome: 'PEDRO', vinculo: 'procurador' }];

describe('linhas de assinatura da vistoria: Calper primeiro, cliente depois', () => {
  it('termo', () => {
    expect(linhasDeAssinatura(quem, 'Maria').split('\n\n')).toEqual([
      '[ASSINATURA REPRESENTANTE DA CALPER: Maria]',
      '[ASSINATURA PROPRIETÁRIO 1: ANA]',
      '[ASSINATURA PROCURADOR 2: PEDRO]'
    ]);
  });
  it('ficha (parte superior) e termo sem nome da Calper (assinado depois, por outra pessoa)', () => {
    expect(linhasDeAssinatura(quem, 'Maria', { ficha: true }).split('\n\n')[0]).toBe('[ASSINATURA FICHA REPRESENTANTE DA CALPER: Maria]');
    expect(linhasDeAssinatura(quem, 'Maria', { semNomeCalper: true }).split('\n\n')[0]).toBe('[ASSINATURA REPRESENTANTE DA CALPER]');
  });
  it('ajustar devolve a linha apagada na prévia, nas duas partes da ficha', () => {
    const texto = ajustarAssinaturasVistoria('FICHA\n[ASSINATURA FICHA REPRESENTANTE DA CALPER: Maria]', quem, 'Maria', { ficha: true });
    expect(texto).toContain('[ASSINATURA FICHA PROPRIETÁRIO 1: ANA]');
    expect(texto).toContain('[ASSINATURA REPRESENTANTE DA CALPER]');
    expect(texto).toContain('[ASSINATURA PROCURADOR 2: PEDRO]');
    expect(ajustarAssinaturasVistoria(texto, quem, 'Maria', { ficha: true })).toBe(texto); // idempotente
  });
});

describe('PDF da ficha + termo (FORM-020)', () => {
  it('gera as duas partes em páginas separadas, sem quebrar', async () => {
    const texto = [
      'FICHA DE REPAROS', 'FICHA DE VISTORIA E ENTREGA DE UNIDADE - FORM-020 - Rev. 06', 'Bloco: 3 | Unidade: 701', '',
      'Reparos necessários:', 'Pintura da sala', '', linhasDeAssinatura(quem, 'Maria', { ficha: true }), '', '[PAGINA]',
      'TERMO DE RECEBIMENTO DO IMÓVEL', 'FICHA DE VISTORIA E ENTREGA DE UNIDADE - FORM-020 - Rev. 06', '', 'Declaro ...', '',
      linhasDeAssinatura(quem, 'Maria', { semNomeCalper: true }), '', 'Assinatura Eletrônica via DocuSign', 'Rodapé.'
    ].join('\n');
    const b64 = await gerarPdfVistoria(texto, 'FORM-020');
    const pdf = await PDFDocument.load(Buffer.from(b64, 'base64'));
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(2);
  });
});
