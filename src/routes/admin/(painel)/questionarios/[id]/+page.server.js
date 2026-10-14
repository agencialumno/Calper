import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { PERGUNTAS_ESCALA, pontosEscala, rotuloEscala } from '$lib/pesquisa.js';

export async function load({ params }) {
  const r = await db.pesquisaSatisfacao.findUnique({
    where: { id: params.id },
    include: {
      agendamento: {
        include: {
          tipoEvento: true,
          investidor: { select: { nome: true } },
          unidade: { include: { empreendimento: true } }
        }
      }
    }
  });
  if (!r) throw error(404, 'Questionário não encontrado');

  const a = r.agendamento;
  return {
    resposta: {
      createdAt: r.createdAt,
      empreendimento: a.unidade.empreendimento.nome,
      unidadeId: a.unidade.id,
      bloco: a.unidade.bloco,
      numero: a.unidade.numero,
      tipoNome: a.tipoEvento.nome,
      dataEvento: a.dataHora,
      respondente: a.nomeCompareceu ?? a.investidor.nome,
      atendidoNoHorario: r.atendidoNoHorario,
      indicariaCalper: r.indicariaCalper,
      pontosFortes: r.pontosFortes,
      oportunidadesMelhoria: r.oportunidadesMelhoria,
      notas: PERGUNTAS_ESCALA.map((q) => ({
        campo: q.campo,
        rotulo: q.rotulo,
        resposta: rotuloEscala(r[q.campo]),
        pontos: pontosEscala(r[q.campo])
      }))
    }
  };
}
