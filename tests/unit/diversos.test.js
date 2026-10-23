import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { juntarPdfs } from '../../src/lib/server/documentos.js';
import { agoraComoRelogioDeBrasilia } from '../../src/lib/server/agenda.js';
import { TAMANHO_MAXIMO_FOTO, lerFotoDePerfil } from '../../src/lib/server/fotoPerfil.js';

const pdfComPaginas = async (n) => {
  const d = await PDFDocument.create();
  for (let i = 0; i < n; i++) d.addPage([200, 200]);
  return Buffer.from(await d.save());
};

describe('PDF completo (termo + checklist)', () => {
  it('junta os PDFs na ordem e soma as páginas', async () => {
    const junto = await juntarPdfs([await pdfComPaginas(2), await pdfComPaginas(3)]);
    expect((await PDFDocument.load(junto)).getPageCount()).toBe(5);
    expect(junto.subarray(0, 5).toString()).toBe('%PDF-');
  });
});

describe('relógio de Brasília gravado como UTC', () => {
  it('13:30 UTC é 10:30 em Brasília', () => {
    expect(agoraComoRelogioDeBrasilia(new Date('2026-10-23T13:30:00Z')).toISOString()).toBe('2026-10-23T10:30:00.000Z');
  });
  it('vira o dia certo (02:00 UTC ainda é o dia anterior em Brasília)', () => {
    expect(agoraComoRelogioDeBrasilia(new Date('2026-10-24T02:00:00Z')).toISOString()).toBe('2026-10-23T23:00:00.000Z');
  });
});

describe('foto de perfil', () => {
  const arquivo = (bytes, nome = 'f.png') => new File([bytes], nome);
  const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
  it('aceita imagem real pequena (pelos primeiros bytes, não pelo nome)', async () => {
    expect(await lerFotoDePerfil(arquivo(PNG, 'foto.txt'))).toMatch(/^data:image\/png;base64,/);
  });
  it('recusa o que não é imagem, mesmo com nome .png', async () => {
    await expect(lerFotoDePerfil(arquivo(Buffer.from('%PDF-1.4 oi'), 'falsa.png'))).rejects.toThrow(/JPG, PNG ou WEBP/);
  });
  it('recusa arquivo acima do limite, dizendo o tamanho e o máximo', async () => {
    const grande = Buffer.concat([PNG, Buffer.alloc(TAMANHO_MAXIMO_FOTO)]);
    await expect(lerFotoDePerfil(arquivo(grande))).rejects.toThrow(/tamanho máximo é 2 MB/);
  });
  it('recusa quando não há arquivo', async () => {
    await expect(lerFotoDePerfil(null)).rejects.toThrow(/Escolha uma imagem/);
  });
});
