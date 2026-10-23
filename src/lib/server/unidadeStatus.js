// Campos de status/base de uma unidade, serializáveis para as telas (datas em ISO, valores como número).
// Usado pelas abas Unidades e Chaves e pelo dossiê: todas mostram as mesmas etiquetas e o mesmo "ver mais".
export const CAMPOS_STATUS_UNIDADE = {
  tipologia: true,
  grupo: true,
  statusQuitacao: true,
  vistoriaStatus: true,
  escrituraAtual: true,
  statusVenda: true,
  dataVenda: true,
  vencidoPago: true,
  vencidoNaoPago: true,
  saldoVincendo: true,
  faseEscritura: true,
  escriturada: true,
  dataEscritura: true,
  escrituraALavrar: true
};

const iso = (d) => (d ? d.toISOString() : null);

/** Dados de status da unidade para o componente UnidadeStatus. */
export function statusDaUnidade(u) {
  return {
    id: u.id,
    tipologia: u.tipologia ?? null,
    grupo: u.grupo ?? null,
    statusQuitacao: u.statusQuitacao ?? null,
    vistoriaStatus: u.vistoriaStatus ?? null,
    escrituraAtual: u.escrituraAtual ?? null,
    statusVenda: u.statusVenda ?? null,
    dataVenda: iso(u.dataVenda),
    vencidoPago: u.vencidoPago ?? null,
    vencidoNaoPago: u.vencidoNaoPago ?? null,
    saldoVincendo: u.saldoVincendo ?? null,
    faseEscritura: u.faseEscritura ?? null,
    escriturada: u.escriturada ?? null,
    dataEscritura: iso(u.dataEscritura),
    escrituraALavrar: u.escrituraALavrar ?? null
  };
}
