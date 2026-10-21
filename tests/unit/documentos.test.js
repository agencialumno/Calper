import { describe, expect, it } from 'vitest';
import { ajustarAssinaturas, chavesInterior, preencher, quartosDaUnidade, textosDePartes } from '../../src/lib/server/documentos.js';

describe('documentos: variáveis e partes', () => {
  it('preencher troca {{chave}} e deixa visível o que falta', () => {
    expect(preencher('Bloco {{bloco}} / {{faltando}}', { bloco: '2' })).toBe('Bloco 2 / {{faltando}}');
  });
  it('regra de chaves de porta interior', () => {
    expect(chavesInterior(2)).toBe('4');
    expect(chavesInterior(3)).toBe('6');
    expect(chavesInterior(null)).toBe('');
  });
  it('quartos vêm da tipologia, com fallback no campo', () => {
    expect(quartosDaUnidade({ tipologia: '3 QUARTOS' })).toBe(3);
    expect(quartosDaUnidade({ quartos: 2 })).toBe(2);
  });
  it('procurador: deixa clara a representação', () => {
    const t = textosDePartes(['A', 'B'], { nome: 'Fulano', vinculo: 'procurador' });
    expect(t.proprietarios).toContain('representados');
    expect(t.assinante).toBe('Fulano (procurador)');
    expect(textosDePartes(['A'], { nome: 'A', vinculo: 'comprador_principal' }).assinante).toBe('A');
    expect(textosDePartes([], null)).toEqual({});
  });
});

describe('ajustarAssinaturas (linha da Calper e do cônjuge)', () => {
  const base = 'Texto\n\n[ASSINATURA DO INVESTIDOR: JOSE]';
  it('acrescenta a linha da M1 quando o texto não tem', () => {
    expect(ajustarAssinaturas(base)).toContain('[ASSINATURA: M1 EMPREENDIMENTOS IMOBILIÁRIOS SPE LTDA]');
  });
  it('não duplica a linha da M1 nem a do cônjuge (idempotente)', () => {
    const uma = ajustarAssinaturas(base, { conjuge: { nome: 'Maria' } });
    const duas = ajustarAssinaturas(uma, { conjuge: { nome: 'Maria' } });
    expect(duas).toBe(uma);
    expect(uma.match(/\[ASSINATURA: M1/g)).toHaveLength(1);
    expect(uma.match(/CÔNJUGE: Maria/g)).toHaveLength(1);
  });
  it('o cônjuge entra logo depois do investidor e antes da M1', () => {
    const t = ajustarAssinaturas(base, { conjuge: { nome: 'Maria' } });
    expect(t.indexOf('INVESTIDOR')).toBeLessThan(t.indexOf('CÔNJUGE'));
    expect(t.indexOf('CÔNJUGE')).toBeLessThan(t.indexOf('M1 EMPREENDIMENTOS'));
  });
});
