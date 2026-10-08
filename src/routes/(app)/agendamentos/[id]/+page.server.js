import { error, redirect } from '@sveltejs/kit';
import QRCode from 'qrcode';
import { db } from '$lib/server/db.js';
import { removerEvento } from '$lib/server/googleCalendar.js';
import { notificarInvestidor, notificarFuncionarios, emailDoInvestidorNaUnidade } from '$lib/server/notificacao.js';
import { templateAgendamentoCancelado } from '$lib/server/email.js';

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
    const agendamento = await db.agendamento.findUnique({
      where: { id: params.id },
      include: { tipoEvento: true, unidade: true }
    });
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

    const emailInvestidor = await emailDoInvestidorNaUnidade(locals.investidor.id, locals.unidadeId);
    const dataFormatada = agendamento.dataHora.toLocaleDateString('pt-BR');
    const horarioFormatado = agendamento.dataHora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    await notificarInvestidor({
      investidorId: locals.investidor.id,
      titulo: 'Agendamento cancelado',
      mensagem: `${agendamento.tipoEvento.nome} de ${dataFormatada} foi cancelado.`,
      link: '/painel',
      email: emailInvestidor
        ? {
            to: emailInvestidor,
            subject: `Agendamento cancelado — ${agendamento.tipoEvento.nome}`,
            html: templateAgendamentoCancelado({
              nomeInvestidor: locals.investidor.nome,
              tipoNome: agendamento.tipoEvento.nome,
              unidade: `${agendamento.unidade.numero} — Bloco ${agendamento.unidade.bloco}`,
              data: dataFormatada,
              horario: horarioFormatado
            })
          }
        : null
    });

    await notificarFuncionarios({
      titulo: 'Agendamento cancelado',
      mensagem: `${locals.investidor.nome} cancelou "${agendamento.tipoEvento.nome}" (Unidade ${agendamento.unidade.numero} — Bloco ${agendamento.unidade.bloco}).`,
      link: '/admin/checkin'
    });

    throw redirect(303, '/painel');
  }
};