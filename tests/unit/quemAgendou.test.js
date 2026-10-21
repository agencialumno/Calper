import { describe, expect, it } from 'vitest';
import { filtrosQuemAgendou } from '../../src/lib/server/quemAgendou.js';

describe('filtrosQuemAgendou', () => {
  it('sem filtros: só entrega de chaves', () => {
    const { where } = filtrosQuemAgendou(new URLSearchParams(''));
    expect(where.tipoEvento.slug).toBe('entrega-chaves');
    expect(where.status).toBeUndefined();
    expect(where.OR).toBeUndefined();
  });
  it('status válido entra; inválido é ignorado', () => {
    expect(filtrosQuemAgendou(new URLSearchParams('status=realizado')).where.status).toBe('realizado');
    expect(filtrosQuemAgendou(new URLSearchParams('status=qualquer')).where.status).toBeUndefined();
  });
  it('busca procura em nome, e-mail, telefone, CPF (só dígitos) e unidade', () => {
    const { where, filtros } = filtrosQuemAgendou(new URLSearchParams('q= 111.444 '));
    expect(filtros.q).toBe('111.444');
    expect(where.OR).toHaveLength(6);
    expect(where.OR.some((c) => c.cpfCompareceu?.contains === '111444')).toBe(true);
  });
});
