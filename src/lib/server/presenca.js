import { db } from './db.js';

/** Filtros da lista de presença a partir da query string (data inicial/final, em dias). */
export function filtrosDePresenca(searchParams) {
  const de = searchParams.get('de') ?? '';
  const ate = searchParams.get('ate') ?? '';
  const q = (searchParams.get('q') ?? '').trim();

  const createdAt = {};
  if (de) {
    const d = new Date(`${de}T00:00:00`);
    if (!Number.isNaN(d.getTime())) createdAt.gte = d;
  }
  if (ate) {
    const d = new Date(`${ate}T23:59:59.999`);
    if (!Number.isNaN(d.getTime())) createdAt.lte = d;
  }

  const where = {};
  if (createdAt.gte || createdAt.lte) where.createdAt = createdAt;
  if (q) {
    where.OR = [
      { nome: { contains: q, mode: 'insensitive' } },
      { unidade: { numero: { contains: q, mode: 'insensitive' } } },
      { unidade: { bloco: { contains: q, mode: 'insensitive' } } }
    ];
  }
  return { filtros: { de, ate, q }, where };
}

export function buscarPresencas(where, opcoes = {}) {
  return db.presencaEntrega.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      unidade: { select: { id: true, bloco: true, numero: true } },
      agendamento: { select: { observacoesAtendimento: true } }
    },
    ...opcoes
  });
}
