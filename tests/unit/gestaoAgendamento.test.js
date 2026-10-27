import { describe, expect, it } from 'vitest';
import { bloqueioAdmin } from '../../src/lib/server/guardaAdmin.js';
import { MOTIVO_MAXIMO, motivoBloqueio, podeGerirAgendamentos, rotuloDataHora, validarMotivo } from '../../src/lib/gestaoAgendamento.js';

const base = (extra = {}) => ({ status: 'confirmado', origem: 'agendamento', checkinEm: null, retiranteNome: null, observacoesAtendimento: null, presencas: 0, documentos: 0, ...extra });

describe('motivoBloqueio (Alterar / Remarcar / Desmarcar)', () => {
  it('agendamento confirmado e sem atendimento: tudo liberado', () => {
    for (const a of ['alterar', 'remarcar', 'desmarcar']) expect(motivoBloqueio(base(), a), a).toBeNull();
  });
  it('realizado e cancelado: nada é permitido', () => {
    for (const status of ['realizado', 'cancelado']) {
      for (const a of ['alterar', 'remarcar', 'desmarcar']) expect(motivoBloqueio(base({ status }), a), `${status}/${a}`).toBeTruthy();
    }
    expect(motivoBloqueio(base({ status: 'realizado' }), 'desmarcar')).toContain('realizado');
  });
  it('atendimento iniciado (check-in, retirante, presença ou observação) bloqueia alterar e remarcar', () => {
    for (const extra of [{ checkinEm: new Date() }, { retiranteNome: 'FULANO' }, { presencas: 1 }, { observacoesAtendimento: 'x' }]) {
      for (const a of ['alterar', 'remarcar']) expect(motivoBloqueio(base(extra), a), JSON.stringify(extra)).toBe('o atendimento já foi iniciado');
    }
  });
  it('documento enviado ao DocuSign bloqueia alterar e remarcar (mas desmarcar continua possível)', () => {
    expect(motivoBloqueio(base({ documentos: 1 }), 'alterar')).toContain('DocuSign');
    expect(motivoBloqueio(base({ documentos: 2 }), 'remarcar')).toContain('DocuSign');
    expect(motivoBloqueio(base({ documentos: 1, retiranteNome: 'X' }), 'desmarcar')).toBeNull();
  });
});

describe('validarMotivo (desmarcar exige motivo curto)', () => {
  it('obrigatório', () => {
    for (const vazio of [undefined, null, '', '   ', 'ab']) expect(validarMotivo(vazio).ok, String(vazio)).toBe(false);
  });
  it('aceita e normaliza espaços', () => {
    expect(validarMotivo('  o cliente   pediu  ')).toEqual({ ok: true, motivo: 'o cliente pediu' });
  });
  it('limite de tamanho', () => {
    expect(validarMotivo('a'.repeat(MOTIVO_MAXIMO)).ok).toBe(true);
    expect(validarMotivo('a'.repeat(MOTIVO_MAXIMO + 1)).ok).toBe(false);
  });
});

describe('permissões e formatação', () => {
  it('só admin e supervisor gerenciam agendamentos', () => {
    expect(podeGerirAgendamentos('admin')).toBe(true);
    expect(podeGerirAgendamentos('supervisor')).toBe(true);
    expect(podeGerirAgendamentos('colaborador')).toBe(false);
    expect(podeGerirAgendamentos('atendimento')).toBe(false); // nome antigo do colaborador
    expect(podeGerirAgendamentos(undefined)).toBe(false);
  });
  it('o servidor (hooks) recusa o colaborador que força a chamada às ações de Quem agendou', () => {
    const evento = (perfil) => ({ url: new URL('https://x.com/admin/quem-agendou?/desmarcar'), request: { method: 'POST' }, locals: { funcionario: { perfil } } });
    expect(bloqueioAdmin(evento('colaborador')).status).toBe(403);
    expect(bloqueioAdmin(evento('supervisor'))).toBeNull();
    expect(bloqueioAdmin(evento('admin'))).toBeNull();
  });
  it('data e hora no relógio gravado como UTC', () => {
    expect(rotuloDataHora(new Date('2026-10-28T10:00:00Z'))).toBe('28/10/2026 às 10:00');
  });
});
