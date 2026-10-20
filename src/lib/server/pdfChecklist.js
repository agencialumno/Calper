import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { LOGO_DOCUMENTOS_BASE64 } from './assets/logoDocumentos.js';
import { quebrarLinhas, textoSeguro } from './pdfTermo.js';
import { COR_LINK, REGRAS_CHECKLIST, desenharLinhaRica, quebrarRico, tokenizar } from './pdfRico.js';

// PDF do Checklist de Entrega de Chaves recriando a 1ª página do documento de referência
// (docs-referencia/CHECKLIST.docx — um arquivo de mala-direta com 500 cópias, só a primeira vale).
// Medidas tiradas do DOCX e do PDF que o Word gera dele, em pontos. Arial ≈ Helvetica.

const PAGINA = { largura: 595.28, altura: 841.89 };
const ESQUERDA = 78; // margem esquerda (1560 twips)
const DIREITA = 524.5; // limite do texto (margem direita de 1416 twips)
const BASE_CORPO = 771; // margem inferior de 1417 twips
const TAMANHO = 11;
const LINHA = 12.65; // Arial 11 pt, espaçamento simples
const LOGO = { x: 236.75, topo: 42.5, largura: 129, altura: 73 };
const TITULO_Y = 173.5;
const CABECALHO_Y = 211.4;
const COR = rgb(0, 0, 0);
const CINZA_CABECALHO = rgb(191 / 255, 191 / 255, 191 / 255);

// tabela: bordas de 1 pt nestas posições x; coluna 1 = descrição, 2 = qtde., 3 = sim, 4 = não
const COLUNAS_X = [77.5, 427.0, 465.0, 501.8, 538.5];
const TEXTO_X = 81.5;
const TEXTO_LARGURA = 341.5;
const DESLOC_CELULA = 0.9; // a célula começa 0,9 pt abaixo do topo da borda
const ALTURA_CABECALHO = 14.0;
// altura mínima de cada linha (itens 1..10 do documento); itens a mais usam a última
const ALTURAS_MINIMAS = [25.2, 17.9, 18.1, 18.1, 18.1, 18.1, 18.1, 24.25, 24.25, 24.25];

const MARCA = /\s+—\s+\(\s*(X?)\s*\)\s*Sim\s+\(\s*(X?)\s*\)\s*Não\s*$/;
const SEPARADOR_QTDE = ' — Qtde. ';

function interpretarItem(corpo) {
  let marca = null;
  const m = corpo.match(MARCA);
  if (m) {
    marca = m[1] ? 'sim' : m[2] ? 'nao' : null;
    corpo = corpo.slice(0, m.index);
  }
  const pos = corpo.lastIndexOf(SEPARADOR_QTDE);
  return pos === -1
    ? { descricao: corpo.trim(), qtde: '', marca }
    : { descricao: corpo.slice(0, pos).trim(), qtde: corpo.slice(pos + SEPARADOR_QTDE.length).trim(), marca };
}

/** Gera o PDF (A4) do checklist a partir do texto final e devolve em base64 puro. */
export async function gerarPdfChecklist(texto, titulo) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(titulo);
  const fonte = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await pdf.embedPng(Buffer.from(LOGO_DOCUMENTOS_BASE64, 'base64'));

  // --- separa o texto em título, cabeçalho, introdução, itens e fecho ---
  const linhas = texto.split(/\r?\n/);
  const ehItem = (l) => /^\d+\.\s/.test(l);
  const primeiroItem = linhas.findIndex(ehItem);
  let ultimoItem = -1;
  linhas.forEach((l, i) => ehItem(l) && (ultimoItem = i));
  const antes = primeiroItem === -1 ? linhas : linhas.slice(0, primeiroItem);
  const itens = primeiroItem === -1 ? [] : linhas.slice(primeiroItem, ultimoItem + 1).filter(ehItem);
  const depois = primeiroItem === -1 ? [] : linhas.slice(ultimoItem + 1);

  const naoVazias = antes.filter((l) => l.trim());
  const tituloTexto = (naoVazias.shift() ?? '').replace('—', '–'); // o documento usa travessão curto
  const grupos = []; // blocos separados por linha em branco, depois do título
  let atual = [];
  for (const l of antes.slice(antes.findIndex((x) => x.trim()) + 1)) {
    if (l.trim()) atual.push(l.trim());
    else if (atual.length) (grupos.push(atual), (atual = []));
  }
  if (atual.length) grupos.push(atual);
  const cabecalho = grupos.shift() ?? [];
  const introducao = grupos.flat().join(' ');

  const fecho = depois.map((l) => l.trim()).filter(Boolean);
  const dataLinha = fecho.find((l) => /^Rio de Janeiro,/.test(l));
  // um bloco por linha [ASSINATURA...]: investidor, cônjuge (se houver) e a Calper (âncora "[ASSINATURA M1")
  const assinaturas = fecho
    .filter((l) => l.startsWith('[ASSINATURA'))
    .map((l) => l.match(/^\[ASSINATURA([^:\]]*)(?::\s*(.*?))?\]\s*$/))
    .filter(Boolean);

  // --- desenho ---
  const paginas = [];
  let pagina;
  const novaPagina = () => {
    pagina = pdf.addPage([PAGINA.largura, PAGINA.altura]);
    paginas.push(pagina);
  };
  const y0 = (yTopo) => PAGINA.altura - yTopo;
  const desenhar = (str, x, yTopo, { f = fonte, cor = COR, tamanho = TAMANHO } = {}) =>
    pagina.drawText(str, { x, y: y0(yTopo), size: tamanho, font: f, color: cor });
  const centro = (str, f, x1, x2) => (x1 + x2) / 2 - f.widthOfTextAtSize(str, TAMANHO) / 2;
  const retangulo = (x, topo, w, h, cor) =>
    pagina.drawRectangle({ x, y: y0(topo + h), width: w, height: h, color: cor });

  novaPagina();
  pagina.drawImage(logo, {
    x: LOGO.x,
    y: PAGINA.altura - LOGO.topo - LOGO.altura,
    width: LOGO.largura,
    height: LOGO.altura
  });

  // título centrado, em negrito e sublinhado
  const t = textoSeguro(negrito, tituloTexto);
  const wTitulo = negrito.widthOfTextAtSize(t, TAMANHO);
  const xTitulo = (ESQUERDA + DIREITA) / 2 - wTitulo / 2;
  desenhar(t, xTitulo, TITULO_Y, { f: negrito });
  retangulo(xTitulo, TITULO_Y + 1.2, wTitulo, 1.2, COR);

  // cabeçalho (negrito): três linhas coladas e a última (proprietário) com mais espaço
  let y = CABECALHO_Y;
  const passosCabecalho = [14.6, 14.6, 19.0];
  cabecalho.forEach((l, i) => {
    if (i > 0) y += passosCabecalho[Math.min(i - 1, passosCabecalho.length - 1)];
    desenhar(textoSeguro(negrito, l), ESQUERDA, y, { f: negrito });
  });

  // introdução justificada
  y += 27.1;
  if (introducao) {
    const larg = DIREITA - ESQUERDA;
    const ls = quebrarLinhas(fonte, textoSeguro(fonte, introducao), TAMANHO, larg);
    ls.forEach((linha, i) => {
      const palavras = linha.split(' ');
      if (i < ls.length - 1 && palavras.length > 1) {
        const soma = palavras.reduce((s, p) => s + fonte.widthOfTextAtSize(p, TAMANHO), 0);
        const espaco = (larg - soma) / (palavras.length - 1);
        let x = ESQUERDA;
        for (const p of palavras) {
          desenhar(p, x, y);
          x += fonte.widthOfTextAtSize(p, TAMANHO) + espaco;
        }
      } else desenhar(linha, ESQUERDA, y);
      if (i < ls.length - 1) y += LINHA;
    });
  }

  // tabela
  const linhaHorizontal = (topo) => retangulo(COLUNAS_X[0], topo, COLUNAS_X[4] - COLUNAS_X[0] + 1, 1, COR);
  const verticais = (topoCelula, h) =>
    COLUNAS_X.forEach((x) => retangulo(x, topoCelula - DESLOC_CELULA, 1, h + DESLOC_CELULA + 1, COR));

  let bordaTopo = y + 15.1;
  linhaHorizontal(bordaTopo);
  // cabeçalho da tabela (cinza, negrito)
  let topoCelula = bordaTopo + DESLOC_CELULA;
  for (let c = 0; c < 4; c++) {
    retangulo(COLUNAS_X[c] + 1, topoCelula, COLUNAS_X[c + 1] - COLUNAS_X[c] - 1, ALTURA_CABECALHO, CINZA_CABECALHO);
  }
  const baseTexto = (topo, h, nLinhas, i = 0) => topo + (h - nLinhas * LINHA) / 2 + 10.3 + i * LINHA;
  const yCab = baseTexto(topoCelula, ALTURA_CABECALHO, 1);
  desenhar('Descrição', TEXTO_X, yCab, { f: negrito });
  [
    ['Qtde.', 1],
    ['Sim', 2],
    ['Não', 3]
  ].forEach(([rotulo, c]) => desenhar(rotulo, centro(rotulo, negrito, COLUNAS_X[c], COLUNAS_X[c + 1]), yCab, { f: negrito }));
  verticais(topoCelula, ALTURA_CABECALHO);
  bordaTopo = topoCelula + ALTURA_CABECALHO + 0.1; // a borda de 1 pt começa 0,1 pt depois do fim da célula
  linhaHorizontal(bordaTopo);

  itens.forEach((linha, idx) => {
    const { descricao, qtde, marca } = interpretarItem(linha.replace(/^\d+\.\s+/, ''));
    const ls = quebrarRico(
      tokenizar(textoSeguro(fonte, descricao), { regras: REGRAS_CHECKLIST }),
      fonte,
      negrito,
      TAMANHO,
      TEXTO_LARGURA
    );
    const minima = ALTURAS_MINIMAS[Math.min(idx, ALTURAS_MINIMAS.length - 1)];
    const h = Math.max(minima, ls.length * LINHA);

    if (bordaTopo + DESLOC_CELULA + h > BASE_CORPO) {
      // a tabela continua em outra página
      novaPagina();
      bordaTopo = 56.7;
      linhaHorizontal(bordaTopo);
    }
    topoCelula = bordaTopo + DESLOC_CELULA;

    ls.forEach((linhaRica, i) => {
      const yL = baseTexto(topoCelula, h, ls.length, i);
      desenharLinhaRica(linhaRica, TEXTO_X, fonte, negrito, TAMANHO, {
        desenharTexto: (str, x, f, cor) => desenhar(str, x, yL, { f, cor }),
        sublinhar: (x, w) => retangulo(x, yL + 1.3, w, 0.6, COR_LINK)
      });
    });
    const yUma = baseTexto(topoCelula, h, 1);
    if (qtde) desenhar(textoSeguro(fonte, qtde), centro(qtde, fonte, COLUNAS_X[1], COLUNAS_X[2]), yUma);
    if (marca) {
      const c = marca === 'sim' ? 2 : 3;
      desenhar('X', centro('X', negrito, COLUNAS_X[c], COLUNAS_X[c + 1]), yUma, { f: negrito });
    }
    verticais(topoCelula, h);
    bordaTopo = topoCelula + h + 0.1;
    linhaHorizontal(bordaTopo);
  });

  // data à direita e bloco de assinatura (a âncora do DocuSign fica invisível sobre a linha)
  let yFecho = bordaTopo + 49.1;
  if (yFecho + 120 + Math.max(0, assinaturas.length - 1) * 75 > BASE_CORPO) {
    novaPagina();
    yFecho = 56.7 + 14.75;
  }
  if (dataLinha) {
    const d = textoSeguro(fonte, dataLinha);
    desenhar(d, DIREITA - fonte.widthOfTextAtSize(d, TAMANHO), yFecho);
  }
  assinaturas.forEach((assinatura, i) => {
    const yLinha = yFecho + 88.6 + i * 75;
    const traco = '_'.repeat(72);
    const xTraco = centro(traco, fonte, ESQUERDA, DIREITA) + 0;
    desenhar(traco, xTraco, yLinha);
    desenhar(assinatura[1].trim() ? `[ASSINATURA${assinatura[1]}` : '[ASSINATURA M1', xTraco, yLinha, { tamanho: 1, cor: rgb(1, 1, 1) });
    const nome = textoSeguro(fonte, (assinatura[2] ?? '').replace(/^\(|\)$/g, ''));
    if (nome) desenhar(nome, centro(nome, negrito, ESQUERDA, DIREITA), yLinha + 14.5, { f: negrito });
  });

  return Buffer.from(await pdf.save()).toString('base64');
}
