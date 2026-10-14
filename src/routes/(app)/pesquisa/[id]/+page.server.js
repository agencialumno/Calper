import { error, fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { PERGUNTAS_ESCALA, escalaValida } from '$lib/pesquisa.js';
import { registrarLog, rotuloInvestidor } from '$lib/server/log.js';

export async function load({ params, locals }) {
  const agendamento = await db.agendamento.findUnique({
    where: { id: params.id },
    include: { tipoEvento: true, pesquisa: true }
  });

  if (!agendamento || agendamento.unidadeId !== locals.unidadeId) {
    throw error(404, 'Agendamento não encontrado');
  }
  if (agendamento.status !== 'realizado') {
    throw redirect(303, '/painel');
  }
  if (agendamento.pesquisa) {
    throw redirect(303, '/painel');
  }

  return {
    tipoNome: agendamento.tipoEvento.nome,
    perguntasEscala: PERGUNTAS_ESCALA
  };
}

export const actions = {
  default: async (event) => {
    const { request, params, locals } = event;
    const agendamento = await db.agendamento.findUnique({ where: { id: params.id } });
    if (!agendamento || agendamento.unidadeId !== locals.unidadeId) {
      return fail(404, { erro: 'Agendamento não encontrado.' });
    }
    if (agendamento.status !== 'realizado') {
      return fail(400, { erro: 'Este questionário de encerramento só pode ser respondido após o evento ser realizado.' });
    }

    const jaRespondida = await db.pesquisaSatisfacao.findUnique({ where: { agendamentoId: params.id } });
    if (jaRespondida) return fail(400, { erro: 'Este questionário de encerramento já foi respondido.' });

    const form = await request.formData();

    const respostasEscala = {};
    for (const p of PERGUNTAS_ESCALA) {
      const valor = String(form.get(p.campo) ?? '');
      if (!escalaValida(valor)) {
        return fail(400, { erro: `Responda: "${p.rotulo}".` });
      }
      respostasEscala[p.campo] = valor;
    }

    const atendidoNoHorario = form.get('atendidoNoHorario');
    const indicariaCalper = form.get('indicariaCalper');
    if (atendidoNoHorario === null || indicariaCalper === null) {
      return fail(400, { erro: 'Responda as duas perguntas de sim/não.' });
    }

    const pontosFortes = String(form.get('pontosFortes') ?? '').trim() || null;
    const oportunidadesMelhoria = String(form.get('oportunidadesMelhoria') ?? '').trim() || null;

    await db.pesquisaSatisfacao.create({
      data: {
        agendamentoId: params.id,
        ...respostasEscala,
        atendidoNoHorario: atendidoNoHorario === 'sim',
        indicariaCalper: indicariaCalper === 'sim',
        pontosFortes,
        oportunidadesMelhoria
      }
    });

    await registrarLog({
      event,
      atorTipo: 'investidor',
      acao: 'pesquisa_respondida',
      descricao: `${rotuloInvestidor(locals.investidor)} respondeu o questionário de encerramento do agendamento ${agendamento.id}`,
      entidadeTipo: 'Agendamento',
      entidadeId: agendamento.id
    });

    throw redirect(303, '/painel?pesquisa=obrigado');
  }
};