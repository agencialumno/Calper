import { describe, expect, it } from 'vitest';
import { FLAG_DADOS_REAIS, descreverResumo, recusaDadosReais, resumirAgendamentos } from '../../scripts/lib/dados-reais.js';

const ag = (extra = {}) => ({ status: 'confirmado', origem: 'agendamento', dataHora: new Date('2026-10-28T10:00:00Z'), createdAt: new Date('2026-10-20T10:00:00Z'), ...extra });

describe('trava dos scripts de limpeza (dados reais)', () => {
  it('sem agendamentos: nada a proteger, o --aplicar segue', () => {
    const r = resumirAgendamentos([]);
    expect(r.temDadosReais).toBe(false);
    expect(recusaDadosReais(r, ['--aplicar'])).toBeNull();
  });
  it('com agendamentos (qualquer origem, status ou data): recusa o --aplicar', () => {
    for (const a of [ag(), ag({ origem: 'atendimento_direto' }), ag({ status: 'cancelado' }), ag({ dataHora: new Date('2030-01-01T09:00:00Z') })]) {
      const r = resumirAgendamentos([a]);
      expect(recusaDadosReais(r, ['--aplicar']), JSON.stringify(a)).toContain('RECUSADO');
    }
  });
  it('só segue com a flag explícita', () => {
    const r = resumirAgendamentos([ag()]);
    expect(recusaDadosReais(r, ['--aplicar', FLAG_DADOS_REAIS])).toBeNull();
    expect(FLAG_DADOS_REAIS).toBe('--confirmo-dados-reais');
  });
  it('a simulação mostra a quantidade afetada, por status e origem, com o intervalo de datas', () => {
    const r = resumirAgendamentos([ag(), ag({ status: 'realizado', origem: 'atendimento_direto', dataHora: new Date('2026-10-30T14:00:00Z') }), ag({ status: 'cancelado' })]);
    expect(r.total).toBe(3);
    expect(r.porStatus).toEqual({ confirmado: 1, realizado: 1, cancelado: 1 });
    expect(r.porOrigem).toEqual({ agendamento: 2, atendimento_direto: 1 });
    const texto = descreverResumo(r).join('\n');
    expect(texto).toContain('3');
    expect(texto).toContain('28/10/2026 a 30/10/2026');
  });
});
