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
    atualizacoes: atualizacoes.map((a) => ({
      id: a.id,
      titulo: a.titulo,
      descricao: a.descricao,
      midiaBase64: a.midiaBase64,
      createdAt: a.createdAt
    }))
  };
}