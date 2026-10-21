// Quais unidades podem ser agendadas pelo formulário público de entrega de chaves.
// A situação vem da planilha da base (Unidade.vistoriaStatus). Unidades em estoque, no jurídico ou em notificação
// não têm entrega de chaves a fazer; unidades sem comprador também não. As demais situações (vistoria ainda não
// aprovada, revistoria etc.) continuam disponíveis — a equipe decide no atendimento. Ajuste a lista abaixo
// se a regra mudar.
export const VISTORIA_SEM_AGENDAMENTO = ['EM ESTOQUE', 'JURÍDICO', 'UNIDADES EM NOTIFICAÇÃO'];

const semAcento = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .trim();

/** @param {{ vistoriaStatus?: string|null, compradores?: unknown }} unidade */
export function unidadeAgendavel(unidade) {
  const bloqueadas = VISTORIA_SEM_AGENDAMENTO.map(semAcento);
  if (bloqueadas.includes(semAcento(unidade.vistoriaStatus))) return false;
  // lista de compradores vazia = sem comprador na base; nulo = base antiga, sem informação (segue disponível)
  if (Array.isArray(unidade.compradores) && unidade.compradores.length === 0) return false;
  return true;
}

/** Motivo pelo qual a unidade não aparece no agendamento (para a equipe), ou null se aparece. */
export function motivoSemAgendamento(unidade) {
  if (unidadeAgendavel(unidade)) return null;
  if (VISTORIA_SEM_AGENDAMENTO.map(semAcento).includes(semAcento(unidade.vistoriaStatus))) {
    return `vistoria: ${unidade.vistoriaStatus}`;
  }
  return 'sem comprador na base';
}
