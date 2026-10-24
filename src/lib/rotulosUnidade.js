// Rótulos e opções dos dados de uma unidade (isomórfico: servidor e navegador).

// Status-Quitação: o app guarda um código curto; a tela mostra o rótulo.
export const ROTULO_QUITACAO = { quitada: 'Saldo quitado', a_vencer: 'A vencer', estoque: 'Estoque', juridico_civel: 'Jurídico cível' };
export const OPCOES_QUITACAO = Object.entries(ROTULO_QUITACAO).map(([valor, rotulo]) => ({ valor, rotulo }));

export const ROTULO_CAMPO = {
  tipologia: 'Tipologia',
  statusQuitacao: 'Status-Quitação',
  compradores: 'Compradores',
  escritura: 'Escritura (base antiga)',
  vistoriaStatus: 'Vistoria',
  grupo: 'Grupo',
  statusVenda: 'Status da venda',
  dataVenda: 'Data da venda',
  vencidoPago: 'Vencido pago',
  vencidoNaoPago: 'Vencido não pago',
  saldoVincendo: 'Saldo vincendo',
  faseEscritura: 'Fase da escritura',
  escriturada: 'Escriturada',
  dataEscritura: 'Data da escritura',
  escrituraAtual: 'Escritura atual',
  escrituraALavrar: 'Escritura a ser lavrada'
};

// Valores conhecidos da base (a planilha consolidada do Murano). A tela de edição oferece estes e, além deles,
// qualquer valor que já exista nas unidades.
export const OPCOES_VISTORIA = [
  'APROVADA',
  'LIBERADA PARA AGENDAMENTO - VISTORIA',
  'VISTORIA AGENDADA',
  'EM REVISTORIA',
  'UNIDADES EM NOTIFICAÇÃO',
  'JURÍDICO',
  'EM ESTOQUE'
];
export const OPCOES_ESCRITURA_ATUAL = [
  'PROMESSA DE COMPRA E VENDA',
  'PROMESSA DE CESSÃO',
  'CESSÃO DE DIREITOS',
  'CESSÃO DE DIREITO (INDISPONIBILIDADE)',
  'CESSÃO - ARREMATAÇÃO',
  'PENDENTE ESCRITURA',
  'ESCRITURA PÚBLICA ASSINADA'
];

/** "SALDO QUITADO" etc. a partir do código guardado; valor desconhecido aparece como está. */
export const rotuloQuitacao = (v) => (v ? (ROTULO_QUITACAO[v] ?? v) : null);

/** Texto curto de uma etiqueta ("PROMESSA DE COMPRA E VENDA" → "Promessa de compra e venda"). */
export function capitalizar(texto) {
  const t = String(texto ?? '').trim().toLowerCase();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
}

const brl = (n) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
/** Data (ISO ou Date) em dd/mm/aaaa, sem deslocar o dia pelo fuso (a base grava datas à meia-noite UTC). */
export const dataBr = (d) => (d ? new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : null);
export const dinheiro = (n) => (n === null || n === undefined ? null : brl(n));

/**
 * Linhas de "ver mais" de uma unidade (dados da base consolidada): só entram os que têm valor.
 * Recebe os campos já serializados (datas como ISO, valores como número).
 */
export function linhasVerMais(u) {
  const linhas = [
    ['Data da venda', dataBr(u.dataVenda)],
    ['Vencido pago', dinheiro(u.vencidoPago)],
    ['Vencido não pago', dinheiro(u.vencidoNaoPago)],
    ['Saldo vincendo', dinheiro(u.saldoVincendo)],
    ['Fase da escritura', u.faseEscritura],
    ['Escriturada', u.escriturada],
    ['Data da escritura', dataBr(u.dataEscritura)],
    ['Escritura a ser lavrada', u.escrituraALavrar]
  ];
  return linhas.filter(([, v]) => v !== null && v !== undefined && v !== '');
}
