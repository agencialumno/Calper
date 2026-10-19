import { db } from '$lib/server/db.js';
import { buscarPresencas, filtrosDePresenca } from '$lib/server/presenca.js';
import { ROTULO_VINCULO, SLUG_ENTREGA_CHAVES, buscarMurano } from '$lib/server/entregaChaves.js';

export async function load({ url }) {
  const { filtros, where } = filtrosDePresenca(url.searchParams);
  const murano = await buscarMurano();

  const [presencas, agendamentosRealizados, totalUnidades] = await Promise.all([
    buscarPresencas(where, { take: 500 }),
    // entrega concluída = termo e checklist assinados (o agendamento vira "realizado")
    db.agendamento.findMany({
      where: { tipoEvento: { slug: SLUG_ENTREGA_CHAVES }, status: 'realizado' },
      include: {
        unidade: { select: { id: true, bloco: true, numero: true } },
        documentosAssinados: { select: { assinadoEm: true } }
      }
    }),
    murano ? db.unidade.count({ where: { empreendimentoId: murano.id } }) : 0
  ]);

  // data da entrega = quando o último documento foi assinado
  const todas = agendamentosRealizados
    .map((a) => ({
      agendamentoId: a.id,
      unidadeId: a.unidade.id,
      unidade: `Bloco ${a.unidade.bloco} - nº ${a.unidade.numero}`,
      retirante: a.retiranteNome,
      entregueEm: a.documentosAssinados.map((d) => d.assinadoEm).filter(Boolean).sort((x, y) => y - x)[0] ?? a.createdAt
    }))
    .sort((a, b) => b.entregueEm - a.entregueEm);

  const de = filtros.de ? new Date(`${filtros.de}T00:00:00`) : null;
  const ate = filtros.ate ? new Date(`${filtros.ate}T23:59:59.999`) : null;
  const q = filtros.q.toLowerCase();
  const entregas = todas.filter(
    (e) =>
      (!de || e.entregueEm >= de) &&
      (!ate || e.entregueEm <= ate) &&
      (!q || e.unidade.toLowerCase().includes(q) || (e.retirante ?? '').toLowerCase().includes(q))
  );
  const unidadesEntregues = new Set(todas.map((e) => e.unidadeId));

  return {
    filtros,
    exportarHref: `/admin/presenca/exportar?${url.searchParams}`,
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
