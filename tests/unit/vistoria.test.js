import { describe, expect, it } from 'vitest';
import { RESULTADO, motivoSemRevistoria, rotuloDaVistoria, signatariosDaVistoria } from '../../src/lib/vistoria.js';
import { ANCORA_VISTORIA } from '../../src/lib/server/ancoras.js';
import { ajustarAssinaturasVistoria, linhasDeAssinatura, procuracaoValidaParaProcurador } from '../../src/lib/server/vistoria.js';
import { gerarPdfBase64 } from '../../src/lib/server/documentos.js';
import { TERMO_VISTORIA_PADRAO } from '../../src/lib/documentosPadrao.js';

const comprador = (nome, email = `${nome.toLowerCase()}@example.com`, vinculo = 'comprador') => ({ nome, email, vinculo });
const procurador = (nome = 'Procurador', email = 'proc@example.com') => ({ nome, email, vinculo: 'procurador', cpf: '52998224725' });

describe('vistoria: quem assina o termo', () => {
  it('todos os compradores presentes assinam', () => {
    const r = signatariosDaVistoria([comprador('Ana', undefined, 'comprador_principal'), comprador('Bia')]);
    expect(r.ok).toBe(true);
    expect(r.signatarios.map((s) => s.nome)).toEqual(['Ana', 'Bia']);
  });
  it('procurador presente com compradores também assina (por último)', () => {
    const r = signatariosDaVistoria([procurador(), comprador('Ana')], { procuracaoValida: true });
    expect(r.ok).toBe(true);
    expect(r.signatarios.map((s) => s.nome)).toEqual(['Ana', 'Procurador']);
  });
  it('sem comprador presente, o procurador com procuração assina sozinho', () => {
    const r = signatariosDaVistoria([procurador()], { procuracaoValida: true });
    expect(r.ok).toBe(true);
    expect(r.signatarios).toHaveLength(1);
    expect(r.signatarios[0].vinculo).toBe('procurador');
  });
  it('sem comprador e sem procurador: bloqueia', () => {
    const r = signatariosDaVistoria([]);
    expect(r.ok).toBe(false);
    expect(r.erro).toMatch(/Marque quem comparece/);
  });
  it('procurador sem procuração: bloqueia (mesmo com compradores presentes)', () => {
    expect(signatariosDaVistoria([procurador()], { procuracaoValida: false }).ok).toBe(false);
    expect(signatariosDaVistoria([procurador(), comprador('Ana')], { procuracaoValida: false }).ok).toBe(false);
  });
  it('exige e-mail de cada signatário e e-mails diferentes', () => {
    expect(signatariosDaVistoria([comprador('Ana', '')]).erro).toMatch(/e-mail de Ana/);
    expect(signatariosDaVistoria([comprador('Ana', 'x@example.com'), comprador('Bia', 'X@example.com')]).erro).toMatch(/diferente/);
  });
  it('limita o número de assinantes', () => {
    const muitos = Array.from({ length: 7 }, (_, i) => comprador(`P${i}`));
    expect(signatariosDaVistoria(muitos).ok).toBe(false);
  });
});

describe('vistoria: procuração do procurador', () => {
  it('vale só para o mesmo CPF; sem CPF registrado vale para quem for confirmado', () => {
    expect(procuracaoValidaParaProcurador({ procuracaoBase64: null }, '52998224725')).toBe(false);
    expect(procuracaoValidaParaProcurador({ procuracaoBase64: 'x', procuracaoCpf: '52998224725' }, '529.982.247-25')).toBe(true);
    expect(procuracaoValidaParaProcurador({ procuracaoBase64: 'x', procuracaoCpf: '11144477735' }, '52998224725')).toBe(false);
    expect(procuracaoValidaParaProcurador({ procuracaoBase64: 'x', procuracaoCpf: null }, '52998224725')).toBe(true);
  });
});

describe('vistoria: resultado, status derivado e revistoria', () => {
  it('rótulos derivados do agendamento', () => {
    expect(rotuloDaVistoria({ status: 'realizado', vistoriaResultado: 'aceita' })).toBe('Vistoria aceita');
    expect(rotuloDaVistoria({ status: 'confirmado', vistoriaResultado: 'aceita' })).toMatch(/aguardando/);
    expect(rotuloDaVistoria({ status: 'realizado', vistoriaResultado: 'nao_aceita' })).toBe('Vistoria não aceita');
    expect(rotuloDaVistoria({ status: 'confirmado', vistoriaResultado: null })).toBe('Agendada');
    expect(rotuloDaVistoria({ status: 'confirmado', vistoriaResultado: null, checkinEm: new Date() })).toBe('Em andamento');
    expect(rotuloDaVistoria({ status: 'cancelado', vistoriaResultado: null })).toBe('Desmarcada');
  });
  it('revistoria só depois de "não aceita" e uma de cada vez', () => {
    expect(motivoSemRevistoria({ status: 'realizado', vistoriaResultado: RESULTADO.naoAceita })).toBeNull();
    expect(motivoSemRevistoria({ status: 'realizado', vistoriaResultado: RESULTADO.aceita })).toMatch(/não aceita/);
    expect(motivoSemRevistoria({ status: 'confirmado', vistoriaResultado: null })).toMatch(/não aceita/);
    expect(motivoSemRevistoria({ status: 'realizado', vistoriaResultado: RESULTADO.naoAceita }, { existeProxima: true })).toMatch(/já existe/);
    expect(motivoSemRevistoria({ status: 'cancelado', vistoriaResultado: RESULTADO.naoAceita })).toMatch(/cancelado/);
  });
});

describe('vistoria: termo e assinaturas', () => {
  const signatarios = [{ nome: 'Ana', vinculo: 'comprador' }, { nome: 'Pedro', vinculo: 'procurador' }];
  it('linhas de assinatura: um bloco por signatário e o representante da Calper (funcionário que atende)', () => {
    const linhas = linhasDeAssinatura(signatarios, 'Maria Atendente');
    expect(linhas).toContain('[ASSINATURA PROPRIETÁRIO 1: Ana]');
    expect(linhas).toContain('[ASSINATURA PROCURADOR 2: Pedro]');
    expect(linhas).toContain('[ASSINATURA REPRESENTANTE DA CALPER: Maria Atendente]');
  });
  it('se a equipe apagou uma linha de assinatura na prévia, ela volta', () => {
    const texto = 'TERMO\n\n[ASSINATURA PROPRIETÁRIO 1: Ana]';
    const ajustado = ajustarAssinaturasVistoria(texto, signatarios, 'Maria');
    expect(ajustado).toContain('[ASSINATURA PROCURADOR 2: Pedro]');
    expect(ajustado).toContain('[ASSINATURA REPRESENTANTE DA CALPER: Maria]');
    expect(ajustarAssinaturasVistoria(ajustado, signatarios, 'Maria')).toBe(ajustado);
  });
  it('âncoras: nenhuma é prefixo de outra', () => {
    const todas = [ANCORA_VISTORIA.calper, ...[1, 2, 3, 4, 5, 6, 10].map(ANCORA_VISTORIA.assinante)];
    for (const a of todas) for (const b of todas) if (a !== b) expect(b.startsWith(a)).toBe(false);
  });
  it('gera o PDF do termo com as assinaturas', async () => {
    const texto = ajustarAssinaturasVistoria(
      TERMO_VISTORIA_PADRAO.replace('{{assinaturas}}', '').replace(/\{\{(\w+)\}\}/g, 'x'),
      signatarios,
      'Maria Atendente'
    );
    const base64 = await gerarPdfBase64(texto, 'Termo de Recebimento do Imóvel', 'vistoria');
    expect(Buffer.from(base64, 'base64').subarray(0, 5).toString()).toBe('%PDF-');
  });
});

describe('rotuloDaTentativa', () => {
  it('1ª é "1ª vistoria"; as seguintes são revistorias', async () => {
    const { rotuloDaTentativa } = await import('../../src/lib/vistoria.js');
    expect(rotuloDaTentativa(1)).toBe('1ª vistoria');
    expect(rotuloDaTentativa(2)).toBe('Revistoria · 2ª vistoria');
  });
});
