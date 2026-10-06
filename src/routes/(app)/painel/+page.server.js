import { db } from '$lib/server/db.js';
import { temAgendamentoAtivo } from '$lib/server/agendamento.js';

export async function load({ locals }) {
  const unidadeId = locals.unidadeId;

  const [agendamentos, tipos] = await Promise.all([
    db.agendamento.findMany({
      where: { unidadeId },
      include: { tipoEvento: true },
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

  return {
    agendamentos: agendamentos.map((a) => ({
      id: a.id,
      tipoNome: a.tipoEvento.nome,
      dataHora: a.dataHora,
      status: a.status
    })),
    tipos: tiposComDisponibilidade
  };
}
