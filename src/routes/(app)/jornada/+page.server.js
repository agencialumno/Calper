import { db } from '$lib/server/db.js';

export async function load({ locals }) {
  const unidade = await db.unidade.findUnique({
    where: { id: locals.unidadeId },
    include: { empreendimento: true }
  });

  const atualizacoes = await db.atualizacaoEstagio.findMany({
    where: { empreendimentoId: unidade.empreendimentoId },
    orderBy: { createdAt: 'desc' }
  });

  return {
    empreendimento: unidade.empreendimento.nome,
    estagioAtual: unidade.empreendimento.estagioAtual,
    etapa: unidade.empreendimento.etapa,
    temBanner: Boolean(unidade.empreendimento.bannerImagemBase64),
    dataLancamento: unidade.empreendimento.dataLancamento,
    dataEntregaPrevista: unidade.empreendimento.dataEntregaPrevista,
    jornadaTitulo: unidade.empreendimento.jornadaTitulo,
    jornadaConteudo: unidade.empreendimento.jornadaConteudo,
    atualizacoes: atualizacoes.map((a) => ({
      id: a.id,
      titulo: a.titulo,
      descricao: a.descricao,
      midiaBase64: a.midiaBase64,
      createdAt: a.createdAt
    }))
  };
}