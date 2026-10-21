import { ancoraDoBloco } from './ancoras.js';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { LOGO_DOCUMENTOS_BASE64 } from './assets/logoDocumentos.js';
import { COR_LINK, REGRAS_TERMO, desenharLinhaRica, quebrarRico, tokenizar } from './pdfRico.js';

// PDF do Termo de Entrega de Chaves recriando o layout do documento de referência
// (docs-referencia/TERMO DE ENTREGA DE CHAVES - MURANO - rev.DOCX). As medidas vêm do próprio DOCX
// (margens, tamanhos, imagem) e do PDF que o Word gera dele (posição de cada linha), em pontos.
// Arial é equivalente a Helvetica em métricas, então as quebras de linha batem com as do Word.

const PAGINA = { largura: 595.28, altura: 841.89 };
const MARGEM = { esquerda: 42.55, direita: 49.6 };
const DIREITA = PAGINA.largura - MARGEM.direita; // 545.68
const TAMANHO = 11;
const PASSO = 14.54; // entrelinha: Arial 11 pt, múltiplo 1,15
const ENTRE_ITENS = 27.2; // linha em branco (Arial 11 pt simples) entre itens numerados
const ENTRE_BLOCOS = 29.1; // linha em branco com entrelinha 1,15
const RECUO_NUMERO = 18; // número do item: 0,5 cm do texto (recuo deslocado de 360 twips)
const RECUO_TEXTO = 36; // texto do item: 720 twips
const TOPO_CORPO = 28.35; // margem superior de 1 cm
const BASE_CORPO = 805.7; // acima do rodapé (rodapé a 22,4 pt da borda)
const BASE_RODAPE = 817.4; // linha de base do "Página X de Y"
const LOGO = { x: 405.95, topo: 32.8, largura: 129, altura: 73 };
const TITULO_Y = 157.2; // linha de base do título (depois do logo)
const CABECALHO_Y = 198.4; // primeira linha depois do título
const ASSINATURA_ESPACO = 72;
const ITENS_COM_ESPACO_CHEIO = new Set(['1.', '7.']);
const COR = rgb(0, 0, 0);

/** Aspas retas viram tipográficas (“ ”), como no documento de referência. */
function aspasTipograficas(texto) {
  return texto.replace(/"([^"]*)"/g, '“$1”');
}

export function textoSeguro(fonte, texto) {
  texto = aspasTipograficas(texto);
  // fontes padrão do PDF só codificam WinAnsi; troca o que não cabe por "?"
  let saida = '';
  for (const ch of texto.replace(/\t/g, ' ')) {
    try {
      fonte.encodeText(ch);
      saida += ch;
    } catch {
      saida += '?';
    }
  }
  return saida;
}

// O Word aperta os espaços de linhas justificadas além do que as métricas puras permitem, então a
// quebra "gulosa" exata produz linhas diferentes das dele. Os três parâmetros foram ajustados contra o
// PDF que o Word gera do documento de referência (reproduz a quebra de 8 dos 11 itens do termo, já com os trechos em negrito).
const FOLGA_BASE = 0; // pt a menos que a largura útil
const ENCOLHIMENTO_POR_ESPACO = 0.7; // pt que cada espaço da linha pode encolher
const FOLGA_PRIMEIRA_LINHA_ITEM = 0; // pt a menos na primeira linha de item numerado

export function quebrarLinhas(fonte, texto, tamanho, larguraMax, { primeiraFolga = 0 } = {}) {
  const palavras = texto.split(/ +/).filter(Boolean);
  const linhas = [];
  let atual = '';
  for (const palavra of palavras) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    const espacos = tentativa.split(' ').length - 1;
    const limite =
      larguraMax - FOLGA_BASE + ENCOLHIMENTO_POR_ESPACO * espacos - (linhas.length === 0 ? primeiraFolga : 0);
    if (!atual || fonte.widthOfTextAtSize(tentativa, tamanho) <= limite) {
      atual = tentativa;
    } else {
      linhas.push(atual);
      atual = palavra;
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

/** Itens do layout: { tipo, ... }; a paginação acontece depois, com todos os itens conhecidos. */
function montarBlocos(texto, fonte, negrito) {
  const blocos = [];
  const linhas = texto.split(/\r?\n/);
  let primeiraVisivel = true;
  let cabecalho = true; // linhas coladas logo depois do título, até a primeira linha em branco
  let ultimoVazio = 0;

  for (const original of linhas) {
    const linha = original.trimEnd();

    if (linha.trim() === '') {
      ultimoVazio++;
      cabecalho = false;
      continue;
    }
    const brancos = ultimoVazio;
    ultimoVazio = 0;

    if (primeiraVisivel) {
      primeiraVisivel = false;
      blocos.push({ tipo: 'titulo', texto: textoSeguro(negrito, linha) });
      continue;
    }

    const assinatura = linha.match(/^\[ASSINATURA([^:\]]*)(?::\s*(.*?))?\]\s*$/);
    if (assinatura) {
      blocos.push({
        tipo: 'assinatura',
        ancora: ancoraDoBloco('termo', assinatura[1]),
        nome: textoSeguro(fonte, assinatura[2] ?? '')
      });
      continue;
    }

    const item = linha.match(/^(\d+)\.\s+(.*)$/);
    if (item) {
      blocos.push({ tipo: 'item', numero: `${item[1]}.`, texto: textoSeguro(fonte, item[2]), brancos });
      continue;
    }

    if (/^Rio de Janeiro,/.test(linha)) {
      blocos.push({ tipo: 'direita', texto: textoSeguro(fonte, linha), brancos });
      continue;
    }

    // no documento de referência "O presente é firmado..." é um parágrafo à parte
    const fecho = linha.match(/^(.*?\.)\s+(O presente é firmado em duas vias de um só teor\.)$/);
    if (!cabecalho && fecho) {
      blocos.push({ tipo: 'paragrafo', texto: textoSeguro(fonte, fecho[1]), brancos });
      blocos.push({ tipo: 'paragrafo', texto: textoSeguro(fonte, fecho[2]), brancos: 1 });
      continue;
    }

    blocos.push({ tipo: cabecalho ? 'cabecalho' : 'paragrafo', texto: textoSeguro(fonte, linha), brancos });
  }
  return blocos;
}

/** Gera o PDF (A4) do termo a partir do texto final e devolve em base64 puro. */
export async function gerarPdfTermo(texto, titulo) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(titulo);
  const fonte = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await pdf.embedPng(Buffer.from(LOGO_DOCUMENTOS_BASE64, 'base64'));

  const paginas = [];
  let pagina;
  let y; // linha de base da última linha desenhada na página atual (distância do topo)

  const novaPagina = () => {
    pagina = pdf.addPage([PAGINA.largura, PAGINA.altura]);
    paginas.push(pagina);
    y = null;
  };
  const desenhar = (str, x, yTopo, { fonteUsada = fonte, tamanho = TAMANHO, cor = COR } = {}) =>
    pagina.drawText(str, { x, y: PAGINA.altura - yTopo, size: tamanho, font: fonteUsada, color: cor });

  // desenha uma linha justificada (espaço extra distribuído entre as palavras); a última fica à esquerda
  const linhaJustificada = (str, x, yTopo, largura, justificar) => {
    const palavras = str.split(' ');
    if (!justificar || palavras.length < 2) return desenhar(str, x, yTopo);
    const larguraPalavras = palavras.reduce((s, p) => s + fonte.widthOfTextAtSize(p, TAMANHO), 0);
    const espaco = (largura - larguraPalavras) / (palavras.length - 1);
    let cursor = x;
    for (const p of palavras) {
      desenhar(p, cursor, yTopo);
      cursor += fonte.widthOfTextAtSize(p, TAMANHO) + espaco;
    }
  };

  const primeiraLinhaDaPagina = TOPO_CORPO + 14.75;
  const cabe = (yTopo, linhas) => yTopo + (linhas - 1) * PASSO <= BASE_CORPO - 2.3;

  novaPagina();
  pagina.drawImage(logo, {
    x: LOGO.x,
    y: PAGINA.altura - LOGO.topo - LOGO.altura,
    width: LOGO.largura,
    height: LOGO.altura
  });

  const blocos = montarBlocos(texto, fonte, negrito);
  let primeiroCabecalho = true;

  for (const b of blocos) {
    if (b.tipo === 'titulo') {
      const w = negrito.widthOfTextAtSize(b.texto, TAMANHO);
      const centro = (MARGEM.esquerda + DIREITA) / 2;
      desenhar(b.texto, centro - w / 2, TITULO_Y, { fonteUsada: negrito });
      y = TITULO_Y;
      continue;
    }

    if (b.tipo === 'assinatura') {
      // espaço acima da linha pro traço do DocuSign; o texto da âncora fica invisível sobre a linha
      let yLinha = y + ASSINATURA_ESPACO;
      if (!cabe(yLinha + PASSO, 1)) {
        novaPagina();
        yLinha = primeiraLinhaDaPagina + 30;
      }
      const traco = '_'.repeat(72);
      const largTraco = negrito.widthOfTextAtSize(traco, TAMANHO);
      const centro = (MARGEM.esquerda + DIREITA) / 2;
      const xTraco = centro - largTraco / 2;
      desenhar(traco, xTraco, yLinha, { fonteUsada: negrito });
      desenhar(b.ancora, xTraco, yLinha, { tamanho: 1, cor: rgb(1, 1, 1) });
      const nome = b.nome.replace(/^\(|\)$/g, '');
      if (nome) {
        const wNome = negrito.widthOfTextAtSize(nome, TAMANHO);
        desenhar(nome, centro - wNome / 2, yLinha + PASSO, { fonteUsada: negrito });
      }
      y = yLinha + PASSO;
      continue;
    }

    const recuoEsquerda = b.tipo === 'item' ? RECUO_TEXTO : 0;
    const xTexto = MARGEM.esquerda + recuoEsquerda;
    const largura = DIREITA - xTexto;
    // cabeçalho: 1ª linha toda em negrito; nas demais só o rótulo até ":"; corpo: destaques fixos do termo
    const palavras = tokenizar(b.texto, {
      regras: b.tipo === 'cabecalho' ? [] : REGRAS_TERMO,
      negritoTotal: b.tipo === 'cabecalho' && primeiroCabecalho,
      negritoAte: b.tipo === 'cabecalho' ? b.texto.indexOf(':') + 1 : 0
    });
    const linhasTexto =
      b.tipo === 'direita'
        ? [palavras]
        : quebrarRico(palavras, fonte, negrito, TAMANHO, largura, {
            folgaBase: FOLGA_BASE,
            encolhimento: ENCOLHIMENTO_POR_ESPACO,
            primeiraFolga: b.tipo === 'item' ? FOLGA_PRIMEIRA_LINHA_ITEM : 0
          });

    // distância (linha de base a linha de base) desde a linha anterior
    const anterior = blocos[blocos.indexOf(b) - 1];
    let passo;
    if (b.tipo === 'cabecalho') {
      passo = primeiroCabecalho ? CABECALHO_Y - y : PASSO;
    } else if (b.tipo === 'item' && anterior?.tipo === 'item') {
      // os itens vêm colados no texto, mas no documento há uma linha em branco entre eles
      // (a dos itens 1 e 7 tem entrelinha cheia; as demais, simples)
      passo = ITENS_COM_ESPACO_CHEIO.has(anterior.numero) ? ENTRE_BLOCOS : ENTRE_ITENS;
    } else if (b.brancos > 0 || b.tipo === 'item') {
      passo = ENTRE_BLOCOS + Math.max(0, b.brancos - 1) * PASSO;
    } else {
      passo = PASSO;
    }

    let yAtual = y + passo;

    // parágrafos não são partidos entre páginas (como no documento: o item 7 começa na página 2)
    const cabeInteiro = cabe(yAtual, linhasTexto.length);
    if (!cabeInteiro) {
      novaPagina();
      yAtual = primeiraLinhaDaPagina;
    }

    const desenharTexto = (str, x, f, cor) => desenhar(str, x, yLinhaAtual, { fonteUsada: f, cor });
    let yLinhaAtual = 0;
    linhasTexto.forEach((linha, i) => {
      yLinhaAtual = yAtual + i * PASSO;
      const sublinhar = (x, w) =>
        pagina.drawRectangle({ x, y: PAGINA.altura - yLinhaAtual - 1.3, width: w, height: 0.6, color: COR_LINK });
      if (b.tipo === 'direita') {
        const w = fonte.widthOfTextAtSize(b.texto, TAMANHO);
        desenhar(b.texto, DIREITA - w, yLinhaAtual);
      } else {
        desenharLinhaRica(linha, xTexto, fonte, negrito, TAMANHO, {
          largura: i < linhasTexto.length - 1 ? largura : null,
          desenharTexto,
          sublinhar
        });
      }
      if (b.tipo === 'item' && i === 0) desenhar(b.numero, MARGEM.esquerda + RECUO_NUMERO, yLinhaAtual);
    });
    if (b.tipo === 'cabecalho') primeiroCabecalho = false;
    y = yAtual + (linhasTexto.length - 1) * PASSO;
  }

  // rodapé "Página X de Y", alinhado à direita, Arial 10 pt
  paginas.forEach((p, i) => {
    const str = `Página ${i + 1} de ${paginas.length}`;
    const w = fonte.widthOfTextAtSize(str, 10);
    p.drawText(str, { x: DIREITA - w, y: PAGINA.altura - BASE_RODAPE, size: 10, font: fonte, color: COR });
  });

  return Buffer.from(await pdf.save()).toString('base64');
}
