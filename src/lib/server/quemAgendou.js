import { SLUG_ENTREGA_CHAVES } from './entregaChaves.js';

/** Filtros de /admin/quem-agendou (busca e status) a partir da query string; o CSV usa os mesmos. */
export function filtrosQuemAgendou(searchParams) {
  const q = (searchParams.get('q') ?? '').trim();
  const status = searchParams.get('status') ?? '';

  const where = {
    tipoEvento: { slug: SLUG_ENTREGA_CHAVES },
    ...(['confirmado', 'realizado', 'cancelado'].includes(status) ? { status } : {}),
    ...(q
      ? {
          OR: [
            { nomeCompareceu: { contains: q, mode: 'insensitive' } },
            { proprietarioNome: { contains: q, mode: 'insensitive' } },
            { emailCompareceu: { contains: q, mode: 'insensitive' } },
            { telefoneCompareceu: { contains: q } },
            { cpfCompareceu: { contains: q.replace(/\D/g, '') || '__sem_digitos__' } },
            { unidade: { numero: { contains: q, mode: 'insensitive' } } }
          ]
        }
      : {})
  };
  return { filtros: { q, status }, where };
}
