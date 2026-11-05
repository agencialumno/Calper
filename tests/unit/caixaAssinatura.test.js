import { describe, expect, it } from 'vitest';
import { LARGURA_LINHA, xOffsetCentralizado } from '../../src/lib/server/caixaAssinatura.js';

describe('xOffsetCentralizado (caixa de assinatura centralizada pela largura do nome)', () => {
  it('nome curto em minúsculas fica mais à direita que nome longo em maiúsculas', () => {
    const curto = Number(xOffsetCentralizado('M1 Empreendimentos'));
    const longo = Number(xOffsetCentralizado('JOSE AUGUSTO SILVA DA FONSECA'));
    expect(curto).toBeGreaterThan(longo);
  });
  it('valores calibrados com assinaturas reais', () => {
    expect(Number(xOffsetCentralizado('Calper Construtora'))).toBeGreaterThan(130);
    expect(Number(xOffsetCentralizado('Calper Construtora'))).toBeLessThan(160);
    expect(Number(xOffsetCentralizado('JOSE AUGUSTO SILVA DA FONSECA'))).toBe(56);
  });
  it('nunca passa da linha nem fica negativo', () => {
    expect(Number(xOffsetCentralizado('A'.repeat(200)))).toBeGreaterThanOrEqual(5);
    expect(Number(xOffsetCentralizado('x'))).toBeLessThanOrEqual(LARGURA_LINHA / 2);
  });
  it('aceita nome vazio ou nulo sem lançar', () => {
    expect(() => xOffsetCentralizado(undefined)).not.toThrow();
    expect(typeof xOffsetCentralizado('')).toBe('string');
  });
});

describe('xOffsetCentralizado com a linha do termo de vistoria (330 pt)', () => {
  it('a caixa fica centralizada na linha mais curta', async () => {
    const { LARGURA_LINHA_VISTORIA } = await import('../../src/lib/server/caixaAssinatura.js');
    for (const nome of ['Pedro Procurador', 'ANA MARIA DOS SANTOS', 'Supervisor Teste']) {
      const off = Number(xOffsetCentralizado(nome, LARGURA_LINHA_VISTORIA));
      const largura = Math.min(LARGURA_LINHA_VISTORIA - 10, nome.length * (nome === nome.toUpperCase() ? 11.3 : 8.6));
      expect(Math.abs(off + largura / 2 - LARGURA_LINHA_VISTORIA / 2)).toBeLessThanOrEqual(5);
    }
    expect(Number(xOffsetCentralizado('JOSE AUGUSTO SILVA DA FONSECA', LARGURA_LINHA_VISTORIA))).toBeLessThan(Number(xOffsetCentralizado('JOSE AUGUSTO SILVA DA FONSECA')) + 1);
  });
});
