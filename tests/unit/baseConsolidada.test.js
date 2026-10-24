import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { calcularDiferencas, lerData, lerNumero, lerPlanilha } from '../../src/lib/server/importarMurano.js';
import { linhasVerMais, rotuloQuitacao } from '../../src/lib/rotulosUnidade.js';

// Planilha SINTÉTICA no layout da base consolidada do Murano (sem nomes de compradores, sem dados reais).
const arquivo = () => fs.readFileSync(new URL('../fixtures/base-consolidada-teste.xlsx', import.meta.url));

describe('base consolidada (planilha nova)', () => {
  it('lê todas as colunas novas e casa "Futura Unid." com o número da unidade', async () => {
    const r = await lerPlanilha(arquivo());
    expect(r.unidades).toHaveLength(4);
    expect(r.erros).toEqual([]);
    expect(r.avisos).toEqual([]);
    const u101 = r.unidades.find((u) => u.numero === '101');
    expect(u101).toMatchObject({
      bloco: '2',
      tipologia: '3 QUARTOS',
      grupo: 'A', // "Grupo A - a quitar até entrega das chaves" → só a letra
      statusVenda: 'VENDIDA',
      dataVenda: '2025-06-19',
      vencidoPago: 375580.19,
      vencidoNaoPago: 135275.7,
      saldoVincendo: 0,
      vistoriaStatus: 'APROVADA',
      faseEscritura: 'SIM (1ª FASE)',
      escriturada: 'CLIENTES COM PCV + CCA',
      dataEscritura: '2025-07-01',
      escrituraAtual: 'PROMESSA DE CESSÃO',
      escrituraALavrar: 'CESSÃO + COMPRA E VENDA'
    });
    // a planilha não traz compradores: lista vazia (os já cadastrados são preservados na atualização)
    expect(u101.compradores).toEqual([]);
  });

  it('Status-Quitação: texto da planilha vira código; célula em branco não vira valor', async () => {
    const { unidades } = await lerPlanilha(arquivo());
    const por = (n) => unidades.find((u) => u.numero === n);
    expect(por('101').statusQuitacao).toBeUndefined(); // em branco
    expect(por('102').statusQuitacao).toBe('quitada'); // SALDO QUITADO
    expect(por('103').statusQuitacao).toBe('estoque');
    expect(por('104').statusQuitacao).toBe('juridico_civel'); // JURÍDICO_CÍVEL
    expect(por('102').grupo).toBe('B');
  });

  it('unidade livre sem venda: datas e valores em branco ficam de fora (não viram zero)', async () => {
    const u = (await lerPlanilha(arquivo())).unidades.find((x) => x.numero === '103');
    expect(u.dataVenda).toBeUndefined();
    expect(u.vencidoPago).toBeUndefined();
    expect(u.statusVenda).toBe('LIVRE - SPE');
  });

  it('upsert: datas e valores iguais ao do banco NÃO geram alteração; só o que mudou aparece', () => {
    const existente = {
      tipologia: '3 QUARTOS', grupo: 'A', statusQuitacao: 'a_vencer', compradores: [{ nome: 'FULANO', principal: true }],
      escritura: null, vistoriaStatus: 'APROVADA', statusVenda: 'VENDIDA',
      dataVenda: new Date('2025-06-19T00:00:00.000Z'), vencidoPago: 375580.19, vencidoNaoPago: 135275.7, saldoVincendo: 0,
      faseEscritura: 'SIM (1ª FASE)', escriturada: 'CLIENTES COM PCV + CCA', dataEscritura: new Date('2025-07-01T00:00:00.000Z'),
      escrituraAtual: 'PROMESSA DE CESSÃO', escrituraALavrar: 'CESSÃO + COMPRA E VENDA'
    };
    const nova = {
      compradores: [], tipologia: '3 QUARTOS', grupo: 'A', statusVenda: 'VENDIDA', dataVenda: '2025-06-19', vencidoPago: 375580.19,
      vencidoNaoPago: 135275.7, saldoVincendo: 0, vistoriaStatus: 'APROVADA', faseEscritura: 'SIM (1ª FASE)',
      escriturada: 'CLIENTES COM PCV + CCA', dataEscritura: '2025-07-01', escrituraAtual: 'PROMESSA DE CESSÃO', escrituraALavrar: 'CESSÃO + COMPRA E VENDA'
    };
    expect(calcularDiferencas(existente, nova).dif).toEqual([]);

    const mudou = { ...nova, statusQuitacao: 'quitada', vencidoPago: 400000, dataVenda: '2025-06-20', escrituraAtual: 'CESSÃO DE DIREITOS' };
    const { dif } = calcularDiferencas(existente, mudou);
    expect(dif.map((d) => d.campo).sort()).toEqual(['dataVenda', 'escrituraAtual', 'statusQuitacao', 'vencidoPago']);
    expect(dif.find((d) => d.campo === 'dataVenda')).toMatchObject({ de: '19/06/2025', para: '20/06/2025' });
    // datas entram no banco como Date (meia-noite UTC), não como texto
    expect(dif.find((d) => d.campo === 'dataVenda').valorNovo).toEqual(new Date('2025-06-20T00:00:00.000Z'));
    // os compradores já cadastrados continuam (planilha sem nomes)
    expect(dif.some((d) => d.campo === 'compradores')).toBe(false);
  });

  it('lerData e lerNumero aceitam os formatos comuns e rejeitam lixo', () => {
    expect(lerData(new Date('2025-06-19T00:00:00.000Z'))).toBe('2025-06-19');
    expect(lerData('19/06/2025')).toBe('2025-06-19');
    expect(lerData('2025-06-19')).toBe('2025-06-19');
    expect(lerData('31/02/2025')).toBeNull();
    expect(lerData('abc')).toBeNull();
    expect(lerData('')).toBeNull();
    expect(lerNumero(1234.5)).toBe(1234.5);
    expect(lerNumero('1.234,56')).toBe(1234.56);
    expect(lerNumero('')).toBeNull();
    expect(lerNumero('abc')).toBeNull();
    expect(lerNumero(0)).toBe(0); // zero é um valor real
  });

  it('"ver mais": só as linhas com valor, na ordem pedida, com data e dinheiro formatados', () => {
    const linhas = linhasVerMais({
      dataVenda: '2025-06-19T00:00:00.000Z', vencidoPago: 1234.5, vencidoNaoPago: 0, saldoVincendo: null,
      faseEscritura: 'SIM (1ª FASE)', escriturada: null, dataEscritura: '2025-07-01T00:00:00.000Z', escrituraALavrar: 'COMPRA E VENDA'
    });
    expect(linhas.map(([r]) => r)).toEqual(['Data da venda', 'Vencido pago', 'Vencido não pago', 'Fase da escritura', 'Data da escritura', 'Escritura a ser lavrada']);
    expect(linhas[0][1]).toBe('19/06/2025');
    expect(linhas[1][1].replace(/\s/g, ' ')).toMatch(/R\$\s?1\.234,50/);
    expect(rotuloQuitacao('quitada')).toBe('Saldo quitado');
    expect(rotuloQuitacao(null)).toBeNull();
  });
});
