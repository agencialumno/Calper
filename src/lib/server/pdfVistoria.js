import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { LOGO_DOCUMENTOS_BASE64 } from './assets/logoDocumentos.js';
import { ANCORA_VISTORIA } from './ancoras.js';
import { quebrarLinhas, textoSeguro } from './pdfTermo.js';

// PDF do Termo de Recebimento do Imóvel (FORM-020 Rev. 06) a partir do texto final:
//  - 1ª linha = título, 2ª = subtítulo; as linhas coladas até a primeira linha em branco = cabeçalho (Obra, Bloco, Nome do Cliente);
//  - "[ASSINATURA ...: nome]" vira linha de assinatura com a âncora invisível do DocuSign (ver ancoras.js);
//  - o que vem depois da última assinatura é o rodapé (texto pequeno).
const PAGINA = { largura: 595.28, altura: 841.89 };
const MARGEM = 56;
const LARGURA_UTIL = PAGINA.largura - MARGEM * 2;
const TAMANHO = 11;
const PASSO = 15;
const ESPACO_ASSINATURA = 46;
const LOGO = { largura: 110, altura: 62 };
const COR = rgb(0.08, 0.08, 0.1);

const MARCADOR = /^\[ASSINATURA (REPRESENTANTE DA CALPER|PROPRIETÁRIO (\d+)|PROCURADOR (\d+))(?::\s*(.*?))?\]\s*$/;

/** Âncora do DocuSign de um marcador de assinatura. */
function ancoraDoMarcador(m) {
  const n = m[2] ?? m[3];
  return n ? ANCORA_VISTORIA.assinante(Number(n)) : ANCORA_VISTORIA.calper;
}

export async function gerarPdfVistoria(texto, titulo) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(titulo);
  const fonte = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await pdf.embedPng(Buffer.from(LOGO_DOCUMENTOS_BASE64, 'base64'));

  const paginas = [];
  let pagina;
  let y; // distância do topo da página até a próxima linha de base
  const novaPagina = () => {
    pagina = pdf.addPage([PAGINA.largura, PAGINA.altura]);
    paginas.push(pagina);
    y = MARGEM;
  };
  const garantir = (altura) => {
    if (y + altura > PAGINA.altura - MARGEM) novaPagina();
  };
  const desenhar = (str, x, f, tamanho, cor = COR) =>
    pagina.drawText(str, { x, y: PAGINA.altura - y, size: tamanho, font: f, color: cor });
  const centralizado = (str, f, tamanho) => desenhar(str, (PAGINA.largura - f.widthOfTextAtSize(str, tamanho)) / 2, f, tamanho);

  novaPagina();
  pagina.drawImage(logo, { x: PAGINA.largura - MARGEM - LOGO.largura, y: PAGINA.altura - MARGEM - LOGO.altura + 14, width: LOGO.largura, height: LOGO.altura });
  y = MARGEM + LOGO.altura + 16;

  const linhas = texto.split(/\r?\n/).map((l) => l.trimEnd());
  const ultimaAssinatura = linhas.reduce((ult, l, i) => (MARCADOR.test(l.trim()) ? i : ult), -1);
  let indiceVisivel = 0;
  let brancos = 0;

  for (let i = 0; i < linhas.length; i++) {
    const original = linhas[i];
    if (original.trim() === '') {
      brancos++;
      continue;
    }
    const marcador = MARCADOR.exec(original.trim());
    const rodape = ultimaAssinatura >= 0 && i > ultimaAssinatura;
    const comoTitulo = indiceVisivel === 0;
    const comoSubtitulo = indiceVisivel === 1;
    indiceVisivel++;

    if (marcador) {
      garantir(ESPACO_ASSINATURA + PASSO * 2);
      y += ESPACO_ASSINATURA;
      const larguraLinha = 330;
      const x = (PAGINA.largura - larguraLinha) / 2;
      pagina.drawLine({ start: { x, y: PAGINA.altura - y }, end: { x: x + larguraLinha, y: PAGINA.altura - y }, thickness: 0.8, color: COR });
      // âncora invisível (branca, 1 pt) sobre o início da linha: o DocuSign posiciona a caixa de assinatura aqui
      pagina.drawText(ancoraDoMarcador(marcador), { x, y: PAGINA.altura - y, size: 1, font: fonte, color: rgb(1, 1, 1) });
      const papel = marcador[1].startsWith('REPRESENTANTE') ? 'Representante da Calper' : marcador[1].startsWith('PROCURADOR') ? 'Procurador' : 'Proprietário';
      const nome = textoSeguro(negrito, marcador[4] ?? '');
      y += PASSO;
      centralizado(nome ? `${nome}` : papel, negrito, TAMANHO);
      y += PASSO - 2;
      if (nome) centralizado(papel, fonte, 9);
      y += PASSO;
      brancos = 0;
      continue;
    }

    const tituloDoRodape = rodape && !linhas.slice(ultimaAssinatura + 1, i).some((l) => l.trim() !== '');
    const f = comoTitulo || comoSubtitulo || tituloDoRodape ? negrito : fonte;
    const tamanho = comoTitulo ? 14 : comoSubtitulo ? 10 : rodape ? 8 : TAMANHO;
    const passo = comoTitulo ? 20 : rodape ? 11 : PASSO;
    const alinhaDireita = /^Rio de Janeiro,/.test(original);
    const limpo = textoSeguro(f, original);
    if (brancos > 0 && !comoTitulo) y += Math.min(brancos, 2) * (passo * 0.7);
    brancos = 0;
    const pedacos = comoTitulo || comoSubtitulo ? [limpo] : quebrarLinhas(f, limpo, tamanho, LARGURA_UTIL);
    for (const pedaco of pedacos) {
      garantir(passo);
      y += passo;
      if (comoTitulo || comoSubtitulo) centralizado(pedaco, f, tamanho);
      else if (alinhaDireita) desenhar(pedaco, PAGINA.largura - MARGEM - f.widthOfTextAtSize(pedaco, tamanho), f, tamanho);
      else desenhar(pedaco, MARGEM, f, tamanho);
    }
  }

  paginas.forEach((p, i) => {
    const str = `Página ${i + 1} de ${paginas.length}`;
    p.drawText(str, { x: PAGINA.largura - MARGEM - fonte.widthOfTextAtSize(str, 9), y: 28, size: 9, font: fonte, color: COR });
  });
  return Buffer.from(await pdf.save()).toString('base64');
}
