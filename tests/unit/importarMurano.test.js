import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { calcularDiferencas, lerPlanilha, mesclarCompradores } from '../../src/lib/server/importarMurano.js';
import { motivoSemAgendamento, unidadeAgendavel } from '../../src/lib/unidadeAgendavel.js';

const base = () => fs.readFileSync(new URL('../fixtures/base-teste.xlsx', import.meta.url));

describe('lerPlanilha', () => {
  it('lê as unidades, agrupa compradores da mesma unidade e ignora a aba de legenda e linhas vazias', async () => {
    const r = await lerPlanilha(base());
    expect(r.unidades).toHaveLength(7);
    const u201 = r.unidades.find((u) => u.numero === '201');
    expect(u201.compradores).toEqual([
      { nome: 'NOVO COMPRADOR A', principal: true },
      { nome: 'NOVO COMPRADOR B', principal: false }
    ]);
    expect(r.erros).toEqual([]);
  });
  it('normaliza pagamento, escritura e vistoria', async () => {
    const { unidades } = await lerPlanilha(base());
    const u101 = unidades.find((u) => u.numero === '101');
    expect(u101).toMatchObject({ bloco: '2', tipologia: '3 QUARTOS', statusQuitacao: 'a_vencer', escritura: 'ESCRITURA PÚBLICA ASSINADA', vistoriaStatus: 'APROVADA' });
    expect(unidades.find((u) => u.numero === '102').statusQuitacao).toBe('quitada');
  });
  it('"N/A" vira unidade sem comprador; células em branco não viram valor', async () => {
    const { unidades } = await lerPlanilha(base());
    const u104 = unidades.find((u) => u.numero === '104');
    expect(u104.compradores).toEqual([]);
    expect(u104.escritura).toBeUndefined();
    expect(u104.statusQuitacao).toBeUndefined();
    expect(u104.vistoriaStatus).toBe('EM ESTOQUE');
  });
  it('avisa quando a coluna GRUPO não existe (o grupo atual será mantido/apagado conforme o modo)', async () => {
    const r = await lerPlanilha(base());
    expect(r.colunasFaltando).toContain('GRUPO');
  });
  it('recusa planilha que não é a base (sem BLOCO/UNIDADE), arquivo vazio e arquivo que não é xlsx', async () => {
    await expect(lerPlanilha(fs.readFileSync(new URL('../fixtures/planilha-errada.xlsx', import.meta.url)))).rejects.toThrow(/BLOCO e UNIDADE/);
    await expect(lerPlanilha(Buffer.alloc(0))).rejects.toThrow(/vazio/);
    await expect(lerPlanilha(Buffer.from('isto não é uma planilha'))).rejects.toThrow(/xlsx/);
  });
});

describe('calcularDiferencas', () => {
  const existente = {
    tipologia: '2 QUARTOS',
    grupo: 'A',
    statusQuitacao: 'quitada',
    compradores: [{ nome: 'FULANO', principal: true }],
    escritura: null,
    vistoriaStatus: null
  };
  it('lista só o que mudou', () => {
    const nova = { tipologia: '2 QUARTOS', statusQuitacao: 'a_vencer', compradores: [{ nome: 'FULANO', principal: true }], escritura: 'ESCRITURA PÚBLICA ASSINADA', vistoriaStatus: 'APROVADA' };
    const { dif } = calcularDiferencas(existente, nova);
    expect(dif.map((d) => d.campo).sort()).toEqual(['escritura', 'statusQuitacao', 'vistoriaStatus']);
    expect(dif.find((d) => d.campo === 'statusQuitacao')).toMatchObject({ de: 'quitada', para: 'a_vencer' });
  });
  it('célula em branco NUNCA apaga o que já existe (nem comprador, nem grupo ausente da planilha)', () => {
    const nova = { compradores: [], tipologia: undefined, statusQuitacao: undefined, escritura: undefined, vistoriaStatus: undefined };
    const { dif, ignorados } = calcularDiferencas(existente, nova);
    expect(dif).toEqual([]);
    expect(ignorados).toContain('compradores');
  });
  it('comprador novo é ACRESCENTADO (ninguém é removido) e o principal segue a planilha', () => {
    const nova = { compradores: [{ nome: 'BELTRANO', principal: true }] };
    const { dif } = calcularDiferencas(existente, nova);
    expect(dif).toHaveLength(1);
    expect(dif[0]).toMatchObject({ campo: 'compradores', de: 'FULANO', para: 'FULANO | BELTRANO (principal)' });
    expect(dif[0].valorNovo).toEqual([{ nome: 'FULANO', principal: false }, { nome: 'BELTRANO', principal: true }]);
  });
  it('planilha só com o principal NÃO remove os co-compradores já cadastrados', () => {
    const comTres = { ...existente, compradores: [{ nome: 'FULANO', principal: true }, { nome: 'CICLANA', principal: false }] };
    const nova = { compradores: [{ nome: 'FULANO', principal: true }] };
    expect(calcularDiferencas(comTres, nova).dif).toEqual([]);
  });
  it('planilha idêntica não gera diferença', () => {
    const nova = { tipologia: '2 QUARTOS', statusQuitacao: 'quitada', compradores: [{ nome: 'FULANO', principal: true }] };
    expect(calcularDiferencas(existente, nova).dif).toEqual([]);
  });
});

describe('unidadeAgendavel (o que aparece no agendamento público)', () => {
  it('estoque, jurídico e notificação ficam de fora', () => {
    for (const v of ['EM ESTOQUE', 'JURÍDICO', 'JURIDICO', 'UNIDADES EM NOTIFICAÇÃO']) {
      expect(unidadeAgendavel({ vistoriaStatus: v, compradores: [{ nome: 'X' }] }), v).toBe(false);
    }
  });
  it('unidade sem comprador (lista vazia) fica de fora; sem informação (nulo) continua disponível', () => {
    expect(unidadeAgendavel({ vistoriaStatus: 'APROVADA', compradores: [] })).toBe(false);
    expect(unidadeAgendavel({ vistoriaStatus: null, compradores: null })).toBe(true);
  });
  it('demais situações de vistoria continuam disponíveis', () => {
    for (const v of ['APROVADA', 'EM REVISTORIA', 'VISTORIA AGENDADA', 'LIBERADA PARA AGENDAMENTO - VISTORIA']) {
      expect(unidadeAgendavel({ vistoriaStatus: v, compradores: [{ nome: 'X' }] }), v).toBe(true);
    }
  });
  it('motivo para a equipe', () => {
    expect(motivoSemAgendamento({ vistoriaStatus: 'EM ESTOQUE', compradores: [] })).toBe('vistoria: EM ESTOQUE');
    expect(motivoSemAgendamento({ vistoriaStatus: 'APROVADA', compradores: [] })).toBe('sem comprador na base');
    expect(motivoSemAgendamento({ vistoriaStatus: 'APROVADA', compradores: [{ nome: 'X' }] })).toBeNull();
  });
});

describe('mesclarCompradores', () => {
  it('compara nomes sem acento e sem diferença de caixa', () => {
    const r = mesclarCompradores([{ nome: 'JOSÉ DA SILVA', principal: true }], [{ nome: 'Jose da Silva', principal: true }]);
    expect(r).toEqual([{ nome: 'JOSÉ DA SILVA', principal: true }]);
  });
  it('sem principal marcado em lugar nenhum, o primeiro vira principal', () => {
    expect(mesclarCompradores([], [{ nome: 'A', principal: false }])[0].principal).toBe(true);
  });
});
