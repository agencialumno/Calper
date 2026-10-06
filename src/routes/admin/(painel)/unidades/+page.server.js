import { db } from '$lib/server/db.js';

export async function load({ url }) {
  const q = url.searchParams.get('q')?.trim() ?? '';

  const where = q
    ? {
        OR: [
          { numero: { contains: q, mode: 'insensitive' } },
          { bloco: { contains: q, mode: 'insensitive' } },
          { empreendimento: { nome: { contains: q, mode: 'insensitive' } } }
        ]
      }
    : {};

  const unidades = await db.unidade.findMany({
    where,
    include: { empreendimento: true, investidores: { include: { investidor: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50
  });

  const total = await db.unidade.count();

  return {
    q,
    total,
    unidades: unidades.map((u) => ({
      id: u.id,
      numero: u.numero,
      bloco: u.bloco,
      empreendimento: u.empreendimento.nome,
      status: u.status,
      investidores: u.investidores.map((vi) => vi.investidor.nome)
    }))
  };
}
