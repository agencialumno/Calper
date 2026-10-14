import { db } from '$lib/server/db.js';

export async function load() {
  const empreendimentos = await db.empreendimento.findMany({
    orderBy: { nome: 'asc' },
    select: {
      id: true,
      nome: true,
      progressoPercentual: true,
      dataEntregaPrevista: true,
      bannerImagemBase64: true,
      _count: { select: { unidades: true } }
    }
  });

  return {
    empreendimentos: empreendimentos.map((e) => ({
      id: e.id,
      nome: e.nome,
      progresso: e.progressoPercentual,
      dataEntregaPrevista: e.dataEntregaPrevista,
      temBanner: Boolean(e.bannerImagemBase64),
      totalUnidades: e._count.unidades
    }))
  };
}
