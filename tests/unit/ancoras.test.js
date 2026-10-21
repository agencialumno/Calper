import { describe, expect, it } from 'vitest';
import { ANCORA, ancoraDoBloco } from '../../src/lib/server/ancoras.js';

describe('âncoras de assinatura', () => {
  it('mapeia cada bloco do texto para a âncora do documento', () => {
    expect(ancoraDoBloco('termo', '')).toBe(ANCORA.termo.calper);
    expect(ancoraDoBloco('termo', ' DO INVESTIDOR')).toBe(ANCORA.termo.cliente);
    expect(ancoraDoBloco('checklist', ' DO CÔNJUGE')).toBe(ANCORA.checklist.conjuge);
    expect(ancoraDoBloco('checklist', ' DO CONJUGE')).toBe(ANCORA.checklist.conjuge);
  });
  it('nenhuma âncora é prefixo de outra (senão a caixa apareceria no lugar errado ou em outro documento)', () => {
    const todas = [...Object.values(ANCORA.termo), ...Object.values(ANCORA.checklist)];
    for (const a of todas) for (const b of todas) if (a !== b) expect(b.startsWith(a)).toBe(false);
  });
});
