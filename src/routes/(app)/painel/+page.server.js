import { db } from '$lib/server/db.js';
import { tipoLiberadoNaEtapa, motivoBloqueioEtapa } from '$lib/etapas.js';
import { temAgendamentoAtivo } from '$lib/server/agendamento.js';

export async function load({ locals }) {
  const unidadeId = locals.unidadeId;
  const mostrarTutorial = !locals.investidor.tutorialVisto;

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
      bloqueado: await temAgendamentoAtivo(unidadeId, t.id),
      foraDaEtapa: !tipoLiberadoNaEtapa(t.slug, unidade.empreendimento.etapa),
      motivoEtapa: motivoBloqueioEtapa(t.slug)
    }))
  );

  const pesquisasPendentes = agendamentos
    .filter((a) => a.status === 'realizado' && !a.pesquisa)
    .map((a) => ({ id: a.id, tipoNome: a.tipoEvento.nome }));

  return {
    mostrarTutorial,
    empreendimento: unidade.empreendimento.nome,
    estagioAtual: unidade.empreendimento.estagioAtual,
    etapa: unidade.empreendimento.etapa,
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