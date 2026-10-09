// Etapas do ciclo de vida do empreendimento — isomórfico (servidor + navegador).

export const ETAPAS = [
  { id: 'lancamento', nome: 'Lançamento', descricao: 'Empreendimento lançado e unidades comercializadas.' },
  { id: 'assinatura', nome: 'Assinatura', descricao: 'Formalização de contratos e escrituras.' },
  { id: 'construcao', nome: 'Construção', descricao: 'Obra em andamento.' },
  { id: 'entrega_chaves', nome: 'Entrega das chaves', descricao: 'Vistoria final e entrega das unidades.' }
];

export const ETAPA_PADRAO = 'construcao';

export function indiceEtapa(id) {
  const i = ETAPAS.findIndex((e) => e.id === id);
  return i === -1 ? ETAPAS.findIndex((e) => e.id === ETAPA_PADRAO) : i;
}

// Em quais etapas cada tipo de evento pode ser agendado. Tipo fora do mapa = sempre liberado.
export const ETAPAS_POR_TIPO = {
  'visita-obra': ['construcao', 'entrega_chaves'],
  escritura: ['assinatura', 'construcao', 'entrega_chaves'],
  vistoria: ['entrega_chaves'],
  'entrega-chaves': ['entrega_chaves']
};

export function tipoLiberadoNaEtapa(slug, etapaId) {
  const permitidas = ETAPAS_POR_TIPO[slug];
  return !permitidas || permitidas.includes(etapaId);
}

/** Texto curto explicando quando o tipo é liberado (usado quando está bloqueado). */
export function motivoBloqueioEtapa(slug) {
  const permitidas = ETAPAS_POR_TIPO[slug];
  if (!permitidas) return '';
  const primeira = ETAPAS.find((e) => e.id === permitidas[0]);
  return `Disponível a partir da etapa "${primeira.nome}"`;
}
