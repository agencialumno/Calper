import { db } from './db.js';

export const SLUG_ENTREGA_CHAVES = 'entrega-chaves';

/** Empreendimento Murano (busca por nome, sem diferenciar maiúsculas). */
export function buscarMurano() {
  return db.empreendimento.findFirst({
    where: { nome: { contains: 'Murano', mode: 'insensitive' } }
  });
}
