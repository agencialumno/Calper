import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { db } from './db.js';
import { PADROES } from '../documentosPadrao.js';
import { gerarPdfTermo } from './pdfTermo.js';
import { gerarPdfChecklist } from './pdfChecklist.js';

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

/** Nº de quartos da unidade: vem da tipologia ("3 QUARTOS") da base Murano; cai no campo `quartos` se faltar. */
export function quartosDaUnidade(unidade) {
  const doTexto = Number(String(unidade.tipologia ?? '').match(/\d+/)?.[0]);
  return doTexto || unidade.quartos || null;
}

/** Regra de chaves de porta interior: 2 quartos → 4, 3 quartos → 6, desconhecido → em branco. */
export function chavesInterior(quartos) {
  if (quartos === 2) return '4';
  if (quartos === 3) return '6';
  return '';
}

/**
 * Pessoas que podem retirar as chaves: Unidade.compradores (principal primeiro) ou, se vazio,
 * os investidores vinculados. `id` é o valor usado no passo "quem retira" do fluxo de entrega.
 */
export function titularesDaUnidade(unidade) {
  const compradores = Array.isArray(unidade.compradores) ? unidade.compradores : [];
  if (compradores.length > 0) {
    return compradores
      .map((c, i) => ({ id: `c${i}`, nome: c.nome, principal: Boolean(c.principal), cpf: null, email: null }))
      .sort((a, b) => Number(b.principal) - Number(a.principal));
  }
  return (unidade.investidores ?? []).map((v) => ({
    id: v.investidorId,
    nome: v.investidor.nome,
    principal: false,
    cpf: v.investidor.cpf,
    email: v.email
  }));
}

/**
 * Textos de "proprietário(s)" e "assinante" do documento.
 * - Quem retira é comprador (ou ainda não foi confirmado): os nomes dos compradores.
 * - Quem retira é procurador: deixa clara a representação.
 *   Com compradores: "A, B, neste ato representados por X, portador(a) de procuração".
 *   Sem compradores: "X, na qualidade de procurador, conforme documento de procuração anexo".
 * Retorna campos ausentes (undefined) quando não há dado, pra {{variável}} ficar visível.
 */
export function textosDePartes(nomesCompradores, retirante) {
  const nomes = nomesCompradores.join(', ');
  if (retirante?.vinculo === 'procurador' && retirante.nome) {
    const proprietarios =
      nomesCompradores.length > 0
        ? `${nomes}, neste ato ${nomesCompradores.length > 1 ? 'representados' : 'representado'} por ${retirante.nome}, portador(a) de procuração`
        : `${retirante.nome}, na qualidade de procurador, conforme documento de procuração anexo`;
    return { proprietarios, assinante: `${retirante.nome} (procurador)` };
  }
  return nomesCompradores.length > 0 ? { proprietarios: nomes, assinante: nomes } : {};
}

export function montarVariaveis({ unidade, partes, variaveisTemplate }) {
  const fixas = Object.fromEntries(
    Object.entries(variaveisTemplate ?? {}).filter(([, v]) => typeof v === 'string' && v.trim() !== '')
  );
  return {
    ...fixas,
    bloco: unidade.bloco,
    unidade: unidade.numero,
    // sem dados, {{proprietarios}} / {{assinante}} ficam visíveis pra equipe completar (e o aviso aparece)
    ...partes,
    dataAssinatura: dataPorExtenso(),
    chavesInterior: chavesInterior(quartosDaUnidade(unidade))
  };
}

const TIPO_TEMPLATE = { termo: 'termo_entrega_chaves', checklist: 'checklist' };

const LINHA_M1 = '[ASSINATURA: M1 EMPREENDIMENTOS IMOBILIÁRIOS SPE LTDA]';

/**
 * Garante os blocos de assinatura do envelope: a linha da M1/Calper (que assina primeiro) em todo documento
 * e, quando há cônjuge, a linha dele logo depois da do investidor. Vale também pra templates antigos já salvos.
 */
export function ajustarAssinaturas(texto, { conjuge = null } = {}) {
  let linhas = texto.split('\n');
  if (!linhas.some((l) => /^\[ASSINATURA:/.test(l.trim()))) {
    while (linhas.length && linhas[linhas.length - 1].trim() === '') linhas.pop();
    linhas.push('', LINHA_M1);
  }
  if (conjuge?.nome && !linhas.some((l) => l.startsWith('[ASSINATURA DO CÔNJUGE'))) {
    const i = linhas.findIndex((l) => l.startsWith('[ASSINATURA DO INVESTIDOR'));
    if (i >= 0) linhas.splice(i + 1, 0, '', `[ASSINATURA DO CÔNJUGE: ${conjuge.nome}]`);
  }
  return linhas.join('\n');
}

/**
 * Texto final de um documento pra uma unidade (termo ou checklist), com as variáveis preenchidas
 * a partir de Unidade (bloco, número, tipologia, compradores) e dos dados fixos do empreendimento.
 * Variáveis sem valor continuam como {{variavel}} pro atendente completar.
 * Mesmo texto que depois é convertido em PDF e mandado pro DocuSign.
 */
export async function montarDocumento(unidadeId, tipo, { retirante = null, conjuge = null } = {}) {
  const unidade = await db.unidade.findUnique({
    where: { id: unidadeId },
    include: { investidores: { include: { investidor: true } } }
  });
  if (!unidade) throw new Error('Unidade não encontrada.');

  const [template, termo] = await Promise.all([
    obterTemplate(unidade.empreendimentoId, TIPO_TEMPLATE[tipo]),
    obterTemplate(unidade.empreendimentoId, TIPO_TEMPLATE.termo) // guarda os dados fixos do empreendimento
  ]);

  const titulares = titularesDaUnidade(unidade);
  const variaveis = montarVariaveis({
    unidade,
    // `retirante` = { nome, vinculo } de quem retira as chaves (passo 2 do fluxo), quando já confirmado
    partes: textosDePartes(titulares.map((t) => t.nome), retirante),
    variaveisTemplate: termo.variaveis
  });

  return { texto: ajustarAssinaturas(preencher(template.conteudo, variaveis), { conjuge }), unidade, titulares };
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
export async function gerarPdfBase64(texto, titulo, tipo = null) {
  if (tipo === 'termo') return gerarPdfTermo(texto, titulo);
  if (tipo === 'checklist') return gerarPdfChecklist(texto, titulo);
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
