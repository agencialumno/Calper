import { describe, expect, it } from 'vitest';
import { HORARIOS_PADRAO, dataHoraDoSlot, dataValida, horarioValido, limiteDoSlot } from '../../src/lib/server/agenda.js';

describe('agenda: validações', () => {
  it('horário e data válidos', () => {
    expect(horarioValido('09:00')).toBe(true);
    expect(horarioValido('24:00')).toBe(false);
    expect(horarioValido('9:00')).toBe(false);
    expect(dataValida('2026-10-28')).toBe(true);
    expect(dataValida('2026-02-30')).toBe(false);
    expect(dataValida('28/10/2026')).toBe(false);
  });
  it('o horário escolhido vira relógio UTC (independe do fuso do servidor)', () => {
    expect(dataHoraDoSlot('2026-10-28', '10:00').toISOString()).toBe('2026-10-28T10:00:00.000Z');
  });
  it('horários padrão do dia', () => {
    expect(HORARIOS_PADRAO).toEqual(['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00']);
  });
});

describe('limiteDoSlot: horário, depois dia, depois padrão geral', () => {
  const config = { limitePorHora: 4 };
  it('sem exceção vale o padrão (4 por hora)', () => {
    expect(limiteDoSlot(config, null, '10:00')).toBe(4);
  });
  it('limite do dia sobrepõe o padrão', () => {
    expect(limiteDoSlot(config, { limitePorHora: 2 }, '10:00')).toBe(2);
  });
  it('limite do horário sobrepõe o do dia, e 0 fecha o horário', () => {
    const dia = { limitePorHora: 2, limitesPorHorario: { '10:00': 0, '11:00': 6 } };
    expect(limiteDoSlot(config, dia, '10:00')).toBe(0);
    expect(limiteDoSlot(config, dia, '11:00')).toBe(6);
    expect(limiteDoSlot(config, dia, '13:00')).toBe(2);
  });
});
