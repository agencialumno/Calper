import { describe, expect, it } from 'vitest';
import { criarZip } from '../../src/lib/server/zip.js';

// leitor mínimo do diretório central, pra conferir o zip sem biblioteca
function lerZip(buf) {
  const fim = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const total = buf.readUInt16LE(fim + 10);
  let pos = buf.readUInt32LE(fim + 16);
  const itens = [];
  for (let i = 0; i < total; i++) {
    expect(buf.readUInt32LE(pos)).toBe(0x02014b50);
    const tamanho = buf.readUInt32LE(pos + 24);
    const nomeLen = buf.readUInt16LE(pos + 28);
    const local = buf.readUInt32LE(pos + 42);
    const nome = buf.subarray(pos + 46, pos + 46 + nomeLen).toString('utf8');
    const dadosIni = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    itens.push({ nome, conteudo: buf.subarray(dadosIni, dadosIni + tamanho) });
    pos += 46 + nomeLen;
  }
  return itens;
}

describe('criarZip', () => {
  it('guarda nomes (com acento) e conteúdo sem perda', () => {
    const zip = criarZip([
      { nome: 'procuracoes/01-João.pdf', conteudo: Buffer.from('%PDF-1.4 abc') },
      { nome: 'LEIA-ME.txt', conteudo: Buffer.from('olá', 'utf8') }
    ]);
    const itens = lerZip(zip);
    expect(itens.map((i) => i.nome)).toEqual(['procuracoes/01-João.pdf', 'LEIA-ME.txt']);
    expect(itens[0].conteudo.toString()).toBe('%PDF-1.4 abc');
    expect(itens[1].conteudo.toString('utf8')).toBe('olá');
  });
  it('zip vazio ainda é um zip válido', () => {
    expect(lerZip(criarZip([]))).toEqual([]);
  });
});
