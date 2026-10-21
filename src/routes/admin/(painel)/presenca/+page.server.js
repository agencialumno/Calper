import { db } from '$lib/server/db.js';
import { buscarPresencas, filtrosDePresenca } from '$lib/server/presenca.js';
import { ROTULO_VINCULO, buscarMurano } from '$lib/server/entregaChaves.js';
import { buscarSituacaoEntregas } from '$lib/server/situacaoEntregas.js';

export async function load({ url }) {
  const { filtros, where } = filtrosDePresenca(url.searchParams);
  const murano = await buscarMurano();

  const [presencas, situacao, totalUnidades] = await Promise.all([
    buscarPresencas(where, { take: 500 }),
    buscarSituacaoEntregas(filtros),
    murano ? db.unidade.count({ where: { empreendimentoId: murano.id } }) : 0
  ]);
  const { receberam: entregas, faltam, unidadesEntregues } = situacao;

  return {
    filtros,
    exportarHref: `/admin/presenca/exportar?${url.searchParams}`,
    exportarEntregasHref: `/admin/presenca/exportar-entregas?${url.searchParams}`,
    faltam,
    totalUnidades,
    totalEntregues: unidadesEntregues.size,
    entregas,
    presencas: presencas.map((p) => ({
      id: p.id,
      nome: p.nome,
      vinculo: ROTULO_VINCULO[p.vinculo] ?? p.vinculo,
      createdAt: p.createdAt,
      unidadeId: p.unidade.id,
      unidade: `Bloco ${p.unidade.bloco} - nº ${p.unidade.numero}`,
      chaveEntregue: unidadesEntregues.has(p.unidade.id)
    }))
  };
}
