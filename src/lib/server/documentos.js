import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { db } from './db.js';
import { PADROES } from '../documentosPadrao.js';

/** Template do empreendimento; cria com o texto padrão na primeira vez. */
export async function obterTemplate(empreendimentoId, tipo) {
  const existente = await db.documentoTemplate.findUnique({
    where: { empreendimentoId_tipo: { empreendimentoId, tipo } }
  });
  if (existente) return existente;
  return db.documentoTemplate.create({
    data: { empreendimentoId, tipo, conteudo: PADROES[tipo] }
  });
}

/** Substitui {{chave}} pelos valores informados; chaves sem valor (undefined) ficam visíveis pro atendente. */
export function preencher(texto, variaveis) {
  return texto.replace(/\{\{\s*(\w+)\s*\}\}/g, (original, chave) =>
    variaveis[chave] === undefined || variaveis[chave] === null ? original : String(variaveis[chave])
  );
}

export function dataPorExtenso(data = new Date()) {
  return data.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo'
  });
}

/** Regra de chaves de porta interior: 2 quartos → 4, 3 quartos → 6, desconhecido → em branco. */
export function chavesInterior(quartos) {
  if (quartos === 2) return '4';
  if (quartos === 3) return '6';
  return '';
}

export function montarVariaveis({ unidade, proprietarios, variaveisTemplate }) {
  const fixas = Object.fromEntries(
    Object.entries(variaveisTemplate ?? {}).filter(([, v]) => typeof v === 'string' && v.trim() !== '')
  );
  return {
    ...fixas,
    bloco: unidade.bloco,
    unidade: unidade.numero,
    proprietarios: proprietarios.join(', '),
    dataAssinatura: dataPorExtenso(),
    chavesInterior: chavesInterior(unidade.quartos)
  };
}

// --- PDF (pdf-lib, sem browser headless — roda no Vercel) ---

const PAGINA = { largura: 595.28, altura: 841.89 };
const MARGEM = 56;

function textoSeguro(fonte, texto) {
  // fontes padrão do PDF só codificam WinAnsi; troca o que não cabe por "?"
  let saida = '';
  for (const ch of texto.replace(/\t/g, '    ')) {
    try {
      fonte.encodeText(ch);
      saida += ch;
    } catch {
      saida += '?';
    }
  }
  return saida;
}

function quebrarLinhas(fonte, texto, tamanho, larguraMax) {
  const palavras = texto.split(' ');
  const linhas = [];
  let atual = '';
  for (const palavra of palavras) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (fonte.widthOfTextAtSize(tentativa, tamanho) <= larguraMax || !atual) {
      atual = tentativa;
    } else {
      linhas.push(atual);
      atual = palavra;
    }
  }
  linhas.push(atual);
  return linhas;
}

/** Gera o PDF (A4) a partir do texto final e devolve em base64 puro. As 2 primeiras linhas viram título. */
export async function gerarPdfBase64(texto, titulo) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(titulo);
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);

  const tamanho = 10.5;
  const entrelinha = 15;
  const larguraUtil = PAGINA.largura - MARGEM * 2;

  let pagina = pdf.addPage([PAGINA.largura, PAGINA.altura]);
  let y = PAGINA.altura - MARGEM;

  const garantirEspaco = (altura) => {
    if (y - altura < MARGEM) {
      pagina = pdf.addPage([PAGINA.largura, PAGINA.altura]);
      y = PAGINA.altura - MARGEM;
    }
  };

  const linhasOriginais = texto.split(/\r?\n/);
  linhasOriginais.forEach((original, idx) => {
    const ehTitulo = idx < 2 && original.trim() !== '';
    const ehAssinatura = original.startsWith('[ASSINATURA');
    const fonte = ehTitulo ? negrito : normal;
    const tam = ehTitulo ? 13 : tamanho;

    if (original.trim() === '') {
      y -= entrelinha * 0.6;
      return;
    }
    // espaço acima da linha de assinatura pro traço do DocuSign (âncora com offset negativo)
    if (ehAssinatura) {
      garantirEspaco(entrelinha + 60);
      y -= 40;
    }

    const limpo = textoSeguro(fonte, original);
    for (const linha of quebrarLinhas(fonte, limpo, tam, larguraUtil)) {
      garantirEspaco(entrelinha);
      y -= entrelinha;
      const x = ehTitulo ? (PAGINA.largura - fonte.widthOfTextAtSize(linha, tam)) / 2 : MARGEM;
      pagina.drawText(linha, { x, y, size: tam, font: fonte, color: rgb(0.1, 0.1, 0.12) });
    }
  });

  return Buffer.from(await pdf.save()).toString('base64');
}
