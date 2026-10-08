import { error, redirect } from '@sveltejs/kit';
import QRCode from 'qrcode';
import { db } from '$lib/server/db.js';
import { removerEvento } from '$lib/server/googleCalendar.js';

export async function load({ params, locals }) {
  const agendamento = await db.agendamento.findUnique({
    where: { id: params.id },
    include: { tipoEvento: true, acompanhantes: true, pesquisa: true }
  });

  if (!agendamento || agendamento.unidadeId !== locals.unidadeId) {
    throw error(404, 'Agendamento não encontrado');
  }

  const qrDataUrl = await QRCode.toDataURL(agendamento.qrToken, { margin: 1, width: 260 });

  return {
    agendamento: {
      id: agendamento.id,
      tipoNome: agendamento.tipoEvento.nome,
      dataHora: agendamento.dataHora,
      status: agendamento.status,
      acompanhantes: agendamento.acompanhantes.map((a) => a.nome),
      temDocumento: Boolean(agendamento.documentoBase64),
      pesquisaPendente: agendamento.status === 'realizado' && !agendamento.pesquisa
    },
    qrDataUrl
  };
}

export const actions = {
  cancelar: async ({ params, locals }) => {
    const agendamento = await db.agendamento.findUnique({ where: { id: params.id } });
    if (!agendamento || agendamento.unidadeId !== locals.unidadeId) {
      throw error(404, 'Agendamento não encontrado');
    }

    await db.agendamento.update({ where: { id: params.id }, data: { status: 'cancelado' } });
    await db.historicoUnidade.create({
      data: {
        unidadeId: locals.unidadeId,
        tipo: 'outro',
        descricao: 'Agendamento cancelado pelo investidor'
      }
    });

    // libera o horário na agenda real da Calper (best-effort — se o Calendar
    // falhar aqui, o cancelamento já foi salvo normalmente)
    if (agendamento.googleEventId) {
      await removerEvento(agendamento.googleEventId);
    }

    throw redirect(303, '/painel');
  }
};