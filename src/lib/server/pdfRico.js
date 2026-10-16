import { rgb } from 'pdf-lib';

// Texto com trechos em negrito/link dentro do mesmo parágrafo, como nos documentos de referência
// (INVESTIDOR(ES), nomes e valores destacados). O texto do sistema é simples; os destaques saem de
// regras fixas aplicadas ao texto já preenchido.

export const COR_LINK = rgb(0.02, 0.39, 0.76);

// trechos em negrito do termo e do checklist (ordem não importa; sobreposições se somam)
export const REGRAS_TERMO = [
  /INVESTIDOR\(ES\)/g,
  /Escritura Pública de Contrato de Construção por Administração e Outros Pactos assinada/g,
  /M1 EMPREENDIMENTOS IMOBILIÁRIOS SPE LTDA/g,
  /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2},?/g,
  /\bo Bloco \S+/g,
  /MURANO RESIDENCIAL/g,
  /Secretaria Municipal de Desenvolvimento Urbano e Licenciamento/g,
  /Certidão nº [\d/]+/g,
  /https?:\/\/\S+/g,
  /código de acesso nº (\d+;?)/g
];
export const REGRAS_CHECKLIST = [/\([Ff]ixado[^)]*\)/g];

const REGRAS_LINK = [/https?:\/\/\S+/g, /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g];

function marcar(texto, regras, grupoUltimo = false) {
  const marcas = new Array(texto.length).fill(false);
  for (const re of regras) {
    for (const m of texto.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'))) {
      // regras com grupo de captura destacam só o grupo (ex: o número do código de acesso)
      const trecho = m[1] !== undefined ? m[1] : m[0];
      const ini = m.index + (m[1] !== undefined ? m[0].indexOf(m[1]) : 0);
      for (let i = ini; i < ini + trecho.length; i++) marcas[i] = true;
    }
  }
  return marcas;
}

/**
 * Divide o texto em palavras; cada palavra é uma lista de segmentos { t, negrito, link }.
 * `negritoTotal` deixa o texto todo em negrito; `negritoAte` deixa em negrito só os primeiros N caracteres.
 */
export function tokenizar(texto, { regras = [], negritoTotal = false, negritoAte = 0 } = {}) {
  const neg = marcar(texto, regras);
  const lnk = marcar(texto, REGRAS_LINK);
  const palavras = [];
  let palavra = [];
  const empurrar = (ch, i) => {
    const negrito = negritoTotal || i < negritoAte || neg[i];
    const link = lnk[i];
    const ult = palavra.at(-1);
    if (ult && ult.negrito === negrito && ult.link === link) ult.t += ch;
    else palavra.push({ t: ch, negrito, link });
  };
  [...texto].forEach((ch, i) => {
    if (ch === ' ') {
      if (palavra.length) palavras.push(palavra);
      palavra = [];
    } else empurrar(ch, i);
  });
  if (palavra.length) palavras.push(palavra);
  return palavras;
}

export const larguraPalavra = (palavra, fonte, negrito, tamanho) =>
  palavra.reduce((s, seg) => s + (seg.negrito ? negrito : fonte).widthOfTextAtSize(seg.t, tamanho), 0);

/** Quebra as palavras em linhas (listas de palavras), com a mesma folga/encolhimento do termo. */
export function quebrarRico(palavras, fonte, negrito, tamanho, larguraMax, { folgaBase = 0, encolhimento = 0, primeiraFolga = 0 } = {}) {
  const espaco = fonte.widthOfTextAtSize(' ', tamanho);
  const linhas = [];
  let atual = [];
  let larguraAtual = 0;
  for (const p of palavras) {
    const w = larguraPalavra(p, fonte, negrito, tamanho);
    const tentativa = atual.length ? larguraAtual + espaco + w : w;
    const espacos = atual.length;
    const limite = larguraMax - folgaBase + encolhimento * espacos - (linhas.length === 0 ? primeiraFolga : 0);
    if (!atual.length || tentativa <= limite) {
      atual.push(p);
      larguraAtual = tentativa;
    } else {
      linhas.push(atual);
      atual = [p];
      larguraAtual = w;
    }
  }
  if (atual.length) linhas.push(atual);
  return linhas;
}

/**
 * Desenha uma linha de palavras em (x, yTopo). `largura` != null justifica (espaço extra entre palavras).
 * `desenharTexto(str, x, font, cor)` desenha um trecho; `sublinhar(x, w)` marca os links.
 */
export function desenharLinhaRica(linha, x, fonte, negrito, tamanho, { largura = null, desenharTexto, sublinhar }) {
  const espacoBase = fonte.widthOfTextAtSize(' ', tamanho);
  let espaco = espacoBase;
  if (largura !== null && linha.length > 1) {
    const soma = linha.reduce((s, p) => s + larguraPalavra(p, fonte, negrito, tamanho), 0);
    espaco = (largura - soma) / (linha.length - 1);
  }
  let cursor = x;
  for (const p of linha) {
    for (const seg of p) {
      const f = seg.negrito ? negrito : fonte;
      const w = f.widthOfTextAtSize(seg.t, tamanho);
      desenharTexto(seg.t, cursor, f, seg.link ? COR_LINK : undefined);
      if (seg.link) sublinhar(cursor, w);
      cursor += w;
    }
    cursor += espaco;
  }
}
