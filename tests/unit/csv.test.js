import { describe, expect, it } from 'vitest';
import { dataHoraAgendada, respostaCsv, sn } from '../../src/lib/server/csv.js';

describe('csv', () => {
  it('usa BOM, ponto e vírgula e aspas escapadas, sem quebra de linha dentro da célula', async () => {
    const r = respostaCsv('x.csv', [['a', 'b"c'], ['d\ne', null]]);
    const bytes = Buffer.from(await r.arrayBuffer());
    // BOM UTF-8 (EF BB BF) pro Excel reconhecer os acentos
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(bytes.subarray(3).toString('utf8')).toBe('"a";"b""c"\r\n"d e";""');
    expect(r.headers.get('content-type')).toContain('text/csv');
    expect(r.headers.get('content-disposition')).toContain('x.csv');
  });
  it('data agendada é o relógio gravado como UTC', () => {
    expect(dataHoraAgendada(new Date('2026-10-29T14:00:00.000Z'))).toEqual({ data: '29/10/2026', hora: '14:00' });
  });
  it('sim ou não', () => {
    expect(sn(true)).toBe('sim');
    expect(sn(0)).toBe('não');
  });
});
