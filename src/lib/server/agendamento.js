import { randomBytes } from 'node:crypto';
import { db } from './db.js';

/** Unidade já tem um agendamento ativo (não cancelado) desse tipo de evento? */
export async function temAgendamentoAtivo(unidadeId, tipoEventoId) {
  const existente = await db.agendamento.findFirst({
    where: { unidadeId, tipoEventoId, status: { not: 'cancelado' } }
  });
  return Boolean(existente);
}

export function gerarQrToken() {
  return randomBytes(16).toString('hex');
}

/** Horários fixos disponíveis por dia (simplificado — bloqueio real via Google Agenda fica para fase 2). */
export const HORARIOS_DISPONIVEIS = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];

/** Primeiro dia útil permitido (amanhã) e janela de agendamento (90 dias à frente). */
export function faixaDeDatasPermitida() {
  const hoje = new Date();
  const minimo = new Date(hoje);
  minimo.setDate(minimo.getDate() + 1);
  const maximo = new Date(hoje);
  maximo.setDate(maximo.getDate() + 90);
  return { minimo, maximo };
}

const MAX_TAMANHO_DOCUMENTO_BYTES = 4 * 1024 * 1024; // 4 MB
const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'application/pdf'];

/** Converte um File (upload) em data URL base64, com validação de tipo/tamanho. */
export async function arquivoParaBase64(file) {
  if (!file || typeof file === 'string' || file.size === 0) return null;
  if (!TIPOS_ACEITOS.includes(file.type)) {
    throw new Error('Documento precisa ser JPG, PNG ou PDF.');
  }
  if (file.size > MAX_TAMANHO_DOCUMENTO_BYTES) {
    throw new Error('Documento muito grande (máximo 4 MB).');
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  return `data:${file.type};base64,${buffer.toString('base64')}`;
}
