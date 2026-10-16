import { db } from '$lib/server/db.js';

// A listagem é agrupada (bloco → andar) e filtrada no navegador, então carrega
// todas as unidades de uma vez (centenas de linhas leves, sem anexos).
export async function load({ url }) {
  const unidades = await db.unidade.findMany({
    include: { empreendimento: true, investidores: { include: { investidor: true } } },
    orderBy: [{ bloco: 'asc' }, { numero: 'asc' }]
  });

  return {
    q: url.searchParams.get('q')?.trim() ?? '',
    total: unidades.length,
    unidades: unidades.map((u) => {
      const compradores = Array.isArray(u.compradores) ? u.compradores : [];
      return {
        id: u.id,
        numero: u.numero,
        bloco: u.bloco,
        empreendimento: u.empreendimento.nome,
        status: u.status,
        tipologia: u.tipologia,
        grupo: u.grupo,
        statusQuitacao: u.statusQuitacao,
        compradores: compradores.map((c) => ({ nome: c.nome, principal: Boolean(c.principal) })),
        investidores: u.investidores.map((vi) => vi.investidor.nome)
      };
    })
  };
}
