import { db } from '$lib/server/db.js';
import { temAgendamentoAtivo } from '$lib/server/agendamento.js';

export async function load({ locals }) {
  const unidadeId = locals.unidadeId;

  const [unidade, agendamentos, tipos] = await Promise.all([
    db.unidade.findUnique({ where: { id: unidadeId }, include: { empreendimento: true } }),
    db.agendamento.findMany({
      where: { unidadeId },
      include: { tipoEvento: true, pesquisa: true },
      orderBy: { dataHora: 'desc' }
    }),
    db.tipoEvento.findMany({ where: { ativo: true }, orderBy: { ordem: 'asc' } })
  ]);

  const tiposComDisponibilidade = await Promise.all(
    tipos.map(async (t) => ({
      slug: t.slug,
      nome: t.nome,
      exigeDocumento: t.exigeDocumento,
      bloqueado: await temAgendamentoAtivo(unidadeId, t.id)
    }))
  );

  const pesquisasPendentes = agendamentos
    .filter((a) => a.status === 'realizado' && !a.pesquisa)
    .map((a) => ({ id: a.id, tipoNome: a.tipoEvento.nome }));

  return {
    empreendimento: unidade.empreendimento.nome,
    estagioAtual: unidade.empreendimento.estagioAtual,
    pesquisasPendentes,
    agendamentos: agendamentos.map((a) => ({
      id: a.id,
      tipoNome: a.tipoEvento.nome,
      dataHora: a.dataHora,
      status: a.status
    })),
    tipos: tiposComDisponibilidade
  };
}