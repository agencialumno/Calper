import { motivoSemAgendamento } from './unidadeAgendavel.js';

// Atendimento direto: a equipe inicia a entrega de chaves de uma unidade pela aba Unidades, sem agendamento prévio.
// Isomórfico (servidor e navegador): decide o que o botão faz para cada unidade.
export const ORIGEM_AGENDAMENTO = 'agendamento';
export const ORIGEM_DIRETO = 'atendimento_direto';
export const ROTULO_DIRETO = 'Atendimento direto';
// CPF reservado (inválido de propósito: ninguém entra com ele) do investidor TÉCNICO que satisfaz a relação obrigatória
// Agendamento → Investidor nos atendimentos diretos. Ele não aparece em listas de investidores nem recebe notificação/e-mail.
export const CPF_TECNICO = '00000000000';

/**
 * Regras (as mesmas do agendamento público + 1 unidade = 1 agendamento de entrega de chaves):
 *  - já existe agendamento (não cancelado) de entrega de chaves → abre o existente, não cria outro;
 *  - unidade fora do agendamento (estoque, jurídico, em notificação, sem comprador) → não inicia, com o motivo;
 *  - unidade de outro empreendimento (a entrega de chaves é só do Murano) → não inicia;
 *  - senão → pode iniciar.
 * @returns {{ acao: 'abrir', agendamentoId: string } | { acao: 'bloqueada', motivo: string } | { acao: 'iniciar' }}
 */
export function avaliarAtendimentoDireto({ unidade, agendamentoExistente = null, ehMurano = true }) {
  if (agendamentoExistente) return { acao: 'abrir', agendamentoId: agendamentoExistente.id };
  if (!ehMurano) return { acao: 'bloqueada', motivo: 'a entrega de chaves é só do Murano' };
  const motivo = motivoSemAgendamento({ vistoriaStatus: unidade.vistoriaStatus ?? null, compradores: unidade.compradores });
  if (motivo) return { acao: 'bloqueada', motivo };
  return { acao: 'iniciar' };
}
