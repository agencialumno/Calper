import { buscarPresencas, filtrosDePresenca } from '$lib/server/presenca.js';
import { ROTULO_VINCULO } from '$lib/server/entregaChaves.js';

export async function load({ url }) {
  const { filtros, where } = filtrosDePresenca(url.searchParams);
  const presencas = await buscarPresencas(where, { take: 500 });

  return {
    filtros,
    exportarHref: `/admin/presenca/exportar?${url.searchParams}`,
    presencas: presencas.map((p) => ({
      id: p.id,
      nome: p.nome,
      vinculo: ROTULO_VINCULO[p.vinculo] ?? p.vinculo,
      createdAt: p.createdAt,
      unidadeId: p.unidade.id,
      unidade: `Bloco ${p.unidade.bloco} - nº ${p.unidade.numero}`
    }))
  };
}
