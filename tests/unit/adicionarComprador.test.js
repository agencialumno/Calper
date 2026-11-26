import { describe, expect, it } from 'vitest';
import { motivoSemAgendamento, semAcento, unidadeAgendavel } from '../../src/lib/unidadeAgendavel.js';
import { avaliarAtendimentoDireto } from '../../src/lib/atendimentoDireto.js';

describe('adicionarComprador e liberação para agendamento', () => {
  it('sem comprador na base: unidade não é agendável e bloqueia atendimento', () => {
    const uSemComprador = { vistoriaStatus: 'APROVADA', compradores: [] };
    expect(unidadeAgendavel(uSemComprador)).toBe(false);
    expect(motivoSemAgendamento(uSemComprador)).toBe('sem comprador na base');
    expect(avaliarAtendimentoDireto({ unidade: uSemComprador })).toEqual({
      acao: 'bloqueada',
      motivo: 'sem comprador na base'
    });
  });

  it('comprador adicionado: unidade fica liberada para agendamento e atendimento', () => {
    const uComComprador = {
      vistoriaStatus: 'APROVADA',
      compradores: [{ nome: 'MARIA SILVA', principal: true }]
    };
    expect(unidadeAgendavel(uComComprador)).toBe(true);
    expect(motivoSemAgendamento(uComComprador)).toBeNull();
    expect(avaliarAtendimentoDireto({ unidade: uComComprador })).toEqual({
      acao: 'iniciar'
    });
  });

  it('semAcento normaliza acentos, maiúsculas e espaços', () => {
    expect(semAcento('  João da Silva  ')).toBe('JOAO DA SILVA');
    expect(semAcento('MARIA ÉLICA')).toBe('MARIA ELICA');
    expect(semAcento(null)).toBe('');
  });

  it('lógica de inclusão de comprador: primeiro comprador é principal automaticamente', () => {
    const atuais = [];
    const novoNome = 'Fulano de Tal';
    const marcarPrincipal = false;

    const ehPrincipal = atuais.length === 0 || marcarPrincipal;
    const novos = ehPrincipal
      ? [...atuais.map((c) => ({ ...c, principal: false })), { nome: novoNome, principal: true }]
      : [...atuais, { nome: novoNome, principal: false }];

    expect(novos).toEqual([{ nome: 'Fulano de Tal', principal: true }]);
  });

  it('lógica de inclusão: segundo comprador como não principal preserva o principal', () => {
    const atuais = [{ nome: 'Fulano de Tal', principal: true }];
    const novoNome = 'Ciclano de Tal';
    const marcarPrincipal = false;

    const ehPrincipal = atuais.length === 0 || marcarPrincipal;
    const novos = ehPrincipal
      ? [...atuais.map((c) => ({ ...c, principal: false })), { nome: novoNome, principal: true }]
      : [...atuais, { nome: novoNome, principal: false }];

    expect(novos).toEqual([
      { nome: 'Fulano de Tal', principal: true },
      { nome: 'Ciclano de Tal', principal: false }
    ]);
  });

  it('lógica de inclusão: novo comprador como principal atualiza anteriores para false', () => {
    const atuais = [{ nome: 'Fulano de Tal', principal: true }];
    const novoNome = 'Ciclano de Tal';
    const marcarPrincipal = true;

    const ehPrincipal = atuais.length === 0 || marcarPrincipal;
    const novos = ehPrincipal
      ? [...atuais.map((c) => ({ ...c, principal: false })), { nome: novoNome, principal: true }]
      : [...atuais, { nome: novoNome, principal: false }];

    expect(novos).toEqual([
      { nome: 'Fulano de Tal', principal: false },
      { nome: 'Ciclano de Tal', principal: true }
    ]);
  });

  it('detecção de duplicados com semAcento', () => {
    const atuais = [{ nome: 'João da Silva', principal: true }];
    const tentativa = '  JOAO DA SILVA ';
    const jaExiste = atuais.some((c) => semAcento(c.nome) === semAcento(tentativa));
    expect(jaExiste).toBe(true);
  });
});
