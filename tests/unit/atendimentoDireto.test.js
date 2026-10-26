import { describe, expect, it } from 'vitest';
import { ORIGEM_DIRETO, ROTULO_DIRETO, avaliarAtendimentoDireto } from '../../src/lib/atendimentoDireto.js';
import { permissaoNoCaminho } from '../../src/lib/perfis.js';

const unidade = (extra = {}) => ({ vistoriaStatus: 'APROVADA', compradores: [{ nome: 'FULANO', principal: true }], ...extra });

describe('avaliarAtendimentoDireto (botão "Iniciar atendimento")', () => {
  it('unidade livre e com comprador: pode iniciar', () => {
    expect(avaliarAtendimentoDireto({ unidade: unidade() })).toEqual({ acao: 'iniciar' });
  });
  it('já tem agendamento de entrega de chaves: abre o existente (não cria outro), mesmo realizado', () => {
    expect(avaliarAtendimentoDireto({ unidade: unidade(), agendamentoExistente: { id: 'ag1', status: 'realizado' } })).toEqual({ acao: 'abrir', agendamentoId: 'ag1' });
  });
  it('o agendamento existente vale mesmo se a unidade hoje estiver fora do agendamento', () => {
    expect(avaliarAtendimentoDireto({ unidade: unidade({ vistoriaStatus: 'EM ESTOQUE' }), agendamentoExistente: { id: 'ag2' } }).acao).toBe('abrir');
  });
  it('estoque, jurídico, notificação e sem comprador: não inicia e diz o motivo', () => {
    for (const v of ['EM ESTOQUE', 'JURÍDICO', 'UNIDADES EM NOTIFICAÇÃO']) {
      const r = avaliarAtendimentoDireto({ unidade: unidade({ vistoriaStatus: v }) });
      expect(r, v).toEqual({ acao: 'bloqueada', motivo: `vistoria: ${v}` });
    }
    expect(avaliarAtendimentoDireto({ unidade: unidade({ compradores: [] }) })).toEqual({ acao: 'bloqueada', motivo: 'sem comprador na base' });
  });
  it('outras situações de vistoria continuam liberadas (como no agendamento público)', () => {
    for (const v of ['EM REVISTORIA', 'VISTORIA AGENDADA', 'LIBERADA PARA AGENDAMENTO - VISTORIA', null]) {
      expect(avaliarAtendimentoDireto({ unidade: unidade({ vistoriaStatus: v }) }).acao, String(v)).toBe('iniciar');
    }
  });
  it('unidade de outro empreendimento: a entrega de chaves é só do Murano', () => {
    expect(avaliarAtendimentoDireto({ unidade: unidade(), ehMurano: false })).toEqual({ acao: 'bloqueada', motivo: 'a entrega de chaves é só do Murano' });
  });
  it('constantes de marcação', () => {
    expect(ORIGEM_DIRETO).toBe('atendimento_direto');
    expect(ROTULO_DIRETO).toBe('Atendimento direto');
  });
});

describe('permissão: colaborador, supervisor e admin iniciam o atendimento', () => {
  it('o botão envia para /admin/entrega-chaves, que é rota de escrita do colaborador', () => {
    for (const perfil of ['colaborador', 'supervisor', 'admin']) {
      expect(permissaoNoCaminho(perfil, 'POST', '/admin/entrega-chaves'), perfil).toBe('ok');
    }
  });
});
