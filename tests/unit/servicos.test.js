import { describe, expect, it } from 'vitest';
import { LISTA_SERVICOS, SERVICO_PADRAO, rotuloDoServico, servicoDoSlug, servicoValido, slugDoServico } from '../../src/lib/servicos.js';

describe('serviços do agendamento', () => {
  it('o padrão continua sendo a entrega de chaves', () => {
    expect(SERVICO_PADRAO).toBe('entrega-chaves');
    expect(servicoValido(undefined)).toBe('entrega-chaves');
    expect(servicoValido('')).toBe('entrega-chaves');
    expect(servicoValido('qualquer coisa')).toBe('entrega-chaves');
    expect(servicoValido('__proto__')).toBe('entrega-chaves');
  });
  it('vistoria e entrega de chaves são aceitas', () => {
    expect(servicoValido('vistoria')).toBe('vistoria');
    expect(servicoValido('entrega-chaves')).toBe('entrega-chaves');
  });
  it('o serviço é o slug do tipo de evento', () => {
    expect(slugDoServico('vistoria')).toBe('vistoria');
    expect(servicoDoSlug('vistoria')).toBe('vistoria');
    expect(servicoDoSlug('visita-obra')).toBe('entrega-chaves');
  });
  it('rótulos e lista do dropdown', () => {
    expect(rotuloDoServico('vistoria')).toBe('Vistoria');
    expect(rotuloDoServico('entrega-chaves')).toBe('Entrega de chaves');
    expect(LISTA_SERVICOS.map((s) => s.rotulo)).toEqual(['Vistoria', 'Entrega de chaves']);
  });
});

import { filtrosQuemAgendou } from '../../src/lib/server/quemAgendou.js';
describe('filtro de serviço em Quem agendou', () => {
  it('padrão continua só entrega; vistoria e todos são opt-in', () => {
    expect(filtrosQuemAgendou(new URLSearchParams('')).where.tipoEvento.slug).toBe('entrega-chaves');
    expect(filtrosQuemAgendou(new URLSearchParams('servico=outro')).filtros.servico).toBe('');
    expect(filtrosQuemAgendou(new URLSearchParams('servico=vistoria')).where.tipoEvento.slug).toBe('vistoria');
    expect(filtrosQuemAgendou(new URLSearchParams('servico=todos')).where.tipoEvento.slug.in).toEqual(['vistoria', 'entrega-chaves']);
  });
});

import { blocoPermitido } from '../../src/lib/servicos.js';
describe('mapa serviço → blocos', () => {
  it('vistoria só no Bloco 3; entrega sem restrição (como hoje)', () => {
    expect(blocoPermitido('vistoria', '3')).toBe(true);
    expect(blocoPermitido('vistoria', '2')).toBe(false);
    expect(blocoPermitido('entrega-chaves', '2')).toBe(true);
    expect(blocoPermitido('entrega-chaves', '9')).toBe(true);
  });
});
