import { describe, expect, it } from 'vitest';
import { CORES_ESCRITURA, NEUTRO, chaveEscritura, corEscrituraAtual } from '../../src/lib/coresEscritura.js';
import { OPCOES_ESCRITURA_ATUAL } from '../../src/lib/rotulosUnidade.js';

// luminância relativa e contraste (WCAG 2.x)
const canal = (v) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
const luminancia = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * canal(n >> 16) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
};
const contraste = (a, b) => {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

describe('cores da etiqueta Escritura atual', () => {
  it('cada status tem a sua cor', () => {
    const esperado = {
      'CESSÃO - ARREMATAÇÃO': 'vermelho',
      'PENDENTE ESCRITURA': 'laranja',
      'ESCRITURA PÚBLICA ASSINADA': 'verde',
      'PROMESSA DE COMPRA E VENDA': 'azul',
      'PROMESSA DE CESSÃO': 'ciano',
      'CESSÃO DE DIREITOS': 'roxo',
      'CESSÃO DE DIREITO (INDISPONIBILIDADE)': 'rosa'
    };
    for (const [status, cor] of Object.entries(esperado)) expect(corEscrituraAtual(status).cor, status).toBe(cor);
  });
  it('as sete opções da tela de edição estão todas mapeadas, cada uma com cor própria', () => {
    const cores = OPCOES_ESCRITURA_ATUAL.map((o) => corEscrituraAtual(o).cor);
    expect(cores).not.toContain('cinza');
    expect(new Set(cores).size).toBe(OPCOES_ESCRITURA_ATUAL.length);
    expect(OPCOES_ESCRITURA_ATUAL.length).toBe(Object.keys(CORES_ESCRITURA).length);
  });
  it('tolera caixa, acento, hífen/travessão e espaços diferentes', () => {
    expect(corEscrituraAtual('Escritura pública assinada').cor).toBe('verde');
    expect(corEscrituraAtual('ESCRITURA PUBLICA ASSINADA').cor).toBe('verde');
    expect(corEscrituraAtual('cessão – arrematação').cor).toBe('vermelho');
    expect(corEscrituraAtual('  Cessao   de   direitos ').cor).toBe('roxo');
    expect(chaveEscritura('CESSÃO - ARREMATAÇÃO')).toBe('CESSAO ARREMATACAO');
  });
  it('valor desconhecido, vazio ou nulo cai no neutro e não quebra', () => {
    for (const v of ['QUALQUER COISA NOVA', '', '—', null, undefined, 123, 'Promessa de compra']) {
      expect(corEscrituraAtual(v), String(v)).toBe(NEUTRO);
    }
  });
  it('cada etiqueta tem contraste de leitura (WCAG AA, 4,5:1) e cores distintas entre si', () => {
    for (const [status, c] of [...Object.entries(CORES_ESCRITURA), ['neutro', NEUTRO]]) {
      expect(contraste(c.fundo, c.texto), status).toBeGreaterThanOrEqual(4.5);
    }
    const fundos = Object.values(CORES_ESCRITURA).map((c) => c.fundo);
    expect(new Set(fundos).size).toBe(fundos.length);
  });
  it('as classes do Tailwind estão por extenso (o Tailwind só gera o que encontra no código)', () => {
    for (const c of [...Object.values(CORES_ESCRITURA), NEUTRO]) expect(c.classe).toMatch(/^bg-[a-z]+-\d+ text-[a-z]+-\d+$/);
  });
});
