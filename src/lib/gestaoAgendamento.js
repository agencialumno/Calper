// Regras de Alterar (trocar a unidade), Remarcar (data/hora) e Desmarcar (cancelar) um agendamento de entrega de chaves.
// Isomórfico (servidor e navegador): as telas usam o mesmo motivo de bloqueio que o servidor aplica.
// NADA é apagado: desmarcar só muda o status para "cancelado" (com motivo, autor e data); alterar e remarcar atualizam o
// registro e guardam o valor anterior no log de auditoria e no histórico das unidades.
import { podeEditar } from './perfis.js';

export const MOTIVO_MINIMO = 3;
export const MOTIVO_MAXIMO = 300;

/** Só admin e supervisor gerenciam agendamentos; colaborador não vê os botões e o servidor recusa. */
export const podeGerirAgendamentos = (perfil) => podeEditar(perfil);

/**
 * @param {{ status: string, origem?: string, checkinEm?: Date|string|null, retiranteNome?: string|null,
 *           observacoesAtendimento?: string|null, presencas?: number, documentos?: number }} ag
 * @param {'alterar'|'remarcar'|'desmarcar'} acao
 * @returns {string|null} o motivo do bloqueio, ou null se pode
 */
export function motivoBloqueio(ag, acao) {
  if (ag.status === 'cancelado') return 'o agendamento já está cancelado';
  if (ag.status === 'realizado') return 'o atendimento já foi realizado';
  if (acao === 'desmarcar') return null; // desmarcar só não vale para cancelado/realizado
  if ((ag.documentos ?? 0) > 0) return 'já há documento (termo/checklist) enviado ao DocuSign';
  const iniciado = Boolean(ag.checkinEm) || Boolean(ag.retiranteNome) || (ag.presencas ?? 0) > 0 || Boolean(ag.observacoesAtendimento);
  if (iniciado) return 'o atendimento já foi iniciado';
  return null;
}

/** Valida o motivo do cancelamento: texto curto, obrigatório. Devolve { ok, motivo } ou { ok: false, erro }. */
export function validarMotivo(bruto) {
  const motivo = String(bruto ?? '').replace(/\s+/g, ' ').trim();
  if (motivo.length < MOTIVO_MINIMO) return { ok: false, erro: 'Informe o motivo do cancelamento.' };
  if (motivo.length > MOTIVO_MAXIMO) return { ok: false, erro: `O motivo pode ter no máximo ${MOTIVO_MAXIMO} caracteres.` };
  return { ok: true, motivo };
}

/** "28/10/2026 às 10:00" a partir do relógio gravado como UTC (convenção dos agendamentos). */
export function rotuloDataHora(dataHora) {
  const iso = new Date(dataHora).toISOString();
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)} às ${iso.slice(11, 16)}`;
}
