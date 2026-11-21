import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import modeloBase64 from './assets/form020-modelo.pdf?base64';
import { ANCORA_FICHA, ANCORA_VISTORIA } from './ancoras.js';
import { textoSeguro } from './pdfTermo.js';

// FORM-020 Rev. 06 (Ficha de Vistoria + Termo de Recebimento): o PDF oficial é a base; só os campos dinâmicos são
// escritos por cima (Bloco, Unidade, Nome do Cliente, Data, reparos, telefone, datas e nomes dos assinantes) e as
// âncoras invisíveis do DocuSign ficam sobre as linhas de assinatura. Coordenadas em pontos, medidas do topo da página.
const ALTURA = 841.92;
const CINZA = rgb(210 / 255, 214 / 255, 220 / 255);
const BRANCO = rgb(1, 1, 1);
const PRETO = rgb(0.08, 0.08, 0.1);

// Linhas de assinatura do modelo. `y` = linha; `calper` = linha da direita (Representante da Empresa);
// `dono` = linha da esquerda (Proprietário) quando há um só; `donos` = faixa usada quando há mais de um.
export const LINHAS_FORM020 = {
  ficha: { y: 395, calper: { x: 352, w: 191 }, dono: { x: 78, w: 164 }, donos: { x: 49, w: 286 } },
  termo: { y: 654.5, calper: { x: 325, w: 206 }, dono: { x: 85, w: 223 }, donos: { x: 49, w: 263 } }
};
const FOLGA = 14;

/** Larguras (pt) das linhas de uma parte do documento, para centralizar a caixa de assinatura. */
export function largurasDasLinhas(parte, nDonos) {
  const L = LINHAS_FORM020[parte === 'ficha' ? 'ficha' : 'termo'];
  return { calper: L.calper.w, assinante: faixasDosDonos(L, nDonos)[0]?.w ?? L.dono.w };
}

function faixasDosDonos(L, n) {
  if (n <= 1) return [{ x: L.dono.x, w: L.dono.w }];
  const w = (L.donos.w - FOLGA * (n - 1)) / n;
  return Array.from({ length: n }, (_, i) => ({ x: L.donos.x + i * (w + FOLGA), w }));
}

// O PDF do modelo entra no código do servidor como base64 (ver vite-pdf-base64.js), então vai junto no deploy.
const bytesDoModelo = () => Buffer.from(modeloBase64, 'base64');

/** Reduz o corpo da fonte até o texto caber em `largura` (mínimo 6 pt); corta com "…" se ainda não couber. */
function ajustar(fonte, str, tamanho, largura) {
  let t = tamanho;
  while (t > 6 && fonte.widthOfTextAtSize(str, t) > largura) t -= 0.25;
  let s = str;
  while (s.length > 1 && fonte.widthOfTextAtSize(s, t) > largura) s = s.slice(0, -2) + '…';
  return { texto: s, tamanho: t };
}

function quebrar(fonte, texto, tamanho, largura) {
  const saida = [];
  for (const par of texto.split(/\r?\n/)) {
    let atual = '';
    for (const palavra of par.split(/\s+/).filter(Boolean)) {
      const tent = atual ? `${atual} ${palavra}` : palavra;
      if (fonte.widthOfTextAtSize(tent, tamanho) <= largura || !atual) atual = tent;
      else {
        saida.push(atual);
        atual = palavra;
      }
    }
    saida.push(atual);
  }
  return saida;
}

/**
 * @param {object} d
 * @param {'ficha'|'termo'} d.parte  'ficha' = vistoria não aceita (ficha de reparos preenchida, termo em branco embaixo);
 *   'termo' = vistoria aceita (ficha marcada como não aplicável).
 * @param {string} d.bloco @param {string} d.unidade @param {string} d.proprietarios @param {string} d.data
 * @param {string} [d.dataCurta] data no cabeçalho (cabe pouco texto); sem ela, usa `data`
 * @param {string} [d.reparos] @param {string} [d.telefone]
 * @param {{nome:string, procurador?:boolean}[]} d.assinantes  na ordem das âncoras (1, 2, ...)
 * @returns {Promise<string>} PDF em base64
 */
export async function gerarPdfModeloVistoria(d) {
  const pdf = await PDFDocument.load(bytesDoModelo());
  pdf.setTitle(d.parte === 'ficha' ? 'FICHA DE VISTORIA E ENTREGA DE UNIDADE - FORM-020' : 'TERMO DE RECEBIMENTO DO IMÓVEL - FORM-020');
  const pg = pdf.getPage(0);
  const fonte = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const seguro = (f, s) => textoSeguro(f, String(s ?? ''));
  const retangulo = (x0, y0, x1, y1, cor = BRANCO) => pg.drawRectangle({ x: x0, y: ALTURA - y1, width: x1 - x0, height: y1 - y0, color: cor });
  const texto = (str, x, y, f, size, cor = PRETO) => pg.drawText(str, { x, y: ALTURA - y, size, font: f, color: cor });

  // Cabeçalho: "Bloco: 2 | Unidade:" do modelo vira dinâmico (o bloco nunca é fixo)
  retangulo(287, 121.5, 436, 134, CINZA);
  const bu = ajustar(negrito, seguro(negrito, `Bloco: ${d.bloco} | Unidade: ${d.unidade}`), 8.5, 145);
  texto(bu.texto, 288.8, 130.3, negrito, bu.tamanho);
  const dt = ajustar(negrito, seguro(negrito, d.dataCurta ?? d.data), 8.5, 82);
  texto(dt.texto, 475, 130.3, negrito, dt.tamanho);
  const nome = ajustar(negrito, seguro(negrito, d.proprietarios), 8.5, 420);
  texto(nome.texto, 131, 148.4, negrito, nome.tamanho);

  if (d.parte === 'ficha') {
    // reparos: área livre entre o enunciado e a caixa do telefone; a fonte encolhe até caber
    const larg = 499;
    const topo = 193;
    const limite = 271;
    const reparos = String(d.reparos ?? '')
      .split(/\r?\n/)
      .map((l) => seguro(fonte, l))
      .join('\n')
      .trim();
    let tamanho = 9.5;
    let linhas = quebrar(fonte, reparos, tamanho, larg);
    while (tamanho > 6.5 && linhas.length * (tamanho + 1.6) > limite - topo) {
      tamanho -= 0.25;
      linhas = quebrar(fonte, reparos, tamanho, larg);
    }
    if (linhas.length * (tamanho + 1.6) > limite - topo) {
      const e = new Error('Os reparos não cabem na Ficha de Vistoria (FORM-020). Resuma o texto dos reparos.');
      e.amigavel = true;
      throw e;
    }
    linhas.forEach((l, i) => texto(l, 52, topo + i * (tamanho + 1.6), fonte, tamanho));
    texto(seguro(fonte, d.telefone ?? ''), 142, 288.4, fonte, 9);
    texto(seguro(fonte, d.data), 440, 352.4, fonte, 8.5);
  } else {
    // vistoria aceita: a ficha de reparos não se aplica; o cabeçalho (unidade, cliente) continua valendo para o termo
    retangulo(44.5, 156.3, 559.8, 429.5);
    const msg = 'FICHA DE REPAROS: NÃO APLICÁVEL';
    const sub = 'Vistoria aceita: nenhum reparo foi necessário.';
    texto(seguro(negrito, msg), (595.28 - negrito.widthOfTextAtSize(seguro(negrito, msg), 11)) / 2, 285, negrito, 11);
    texto(seguro(fonte, sub), (595.28 - fonte.widthOfTextAtSize(seguro(fonte, sub), 9.5)) / 2, 302, fonte, 9.5);
    texto(seguro(fonte, d.data), 440, 584.6, fonte, 8.5); // "Rio de Janeiro, ___" do termo
  }

  const donos = d.assinantes;
  const bloco = (parte, ancoras, rotuloY, apagar) => {
    const L = LINHAS_FORM020[parte];
    // âncoras invisíveis (brancas, 1 pt) sobre o início de cada linha: o DocuSign põe a caixa de assinatura aqui
    texto(ancoras.calper, L.calper.x, L.y, fonte, 1, BRANCO);
    const faixas = faixasDosDonos(L, donos.length);
    if (donos.length > 1) {
      apagar(); // troca a linha única do modelo por uma linha por assinante
      faixas.forEach((f, i) => {
        pg.drawLine({ start: { x: f.x, y: ALTURA - L.y }, end: { x: f.x + f.w, y: ALTURA - L.y }, thickness: 0.8, color: PRETO });
        const a = ajustar(negrito, seguro(negrito, donos[i].nome), 7.5, f.w);
        texto(a.texto, f.x + (f.w - negrito.widthOfTextAtSize(a.texto, a.tamanho)) / 2, rotuloY - 2, negrito, a.tamanho);
        const papel = donos[i].procurador ? 'Procurador' : 'Proprietário';
        texto(papel, f.x + (f.w - fonte.widthOfTextAtSize(papel, 7)) / 2, rotuloY + 7, fonte, 7);
      });
    }
    faixas.forEach((f, i) => texto(ancoras.assinante(i + 1), f.x, L.y, fonte, 1, BRANCO));
  };
  if (d.parte === 'ficha') bloco('ficha', ANCORA_FICHA, 409, () => { retangulo(70, 389, 250, 399); retangulo(60, 404.5, 312, 415); });
  bloco('termo', ANCORA_VISTORIA, 666, () => { retangulo(80, 650.5, 312, 658.5); retangulo(60, 661, 312, 673); });

  return Buffer.from(await pdf.save()).toString('base64');
}
