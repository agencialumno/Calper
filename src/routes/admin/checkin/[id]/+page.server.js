import { error, fail } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { notificarInvestidor, emailDoInvestidorNaUnidade } from '$lib/server/notificacao.js';
import { templatePesquisaDisponivel } from '$lib/server/email.js';

export async function load({ params }) {
  const agendamento = await db.agendamento.findUnique({
    where: { id: params.id },
    include: {
      tipoEvento: true,
      investidor: true,
      acompanhantes: true,
      unidade: {
        include: {
          empreendimento: true,
          investidores: { include: { investidor: true } }
        }
      }
    }
  });

  if (!agendamento) throw error(404, 'Agendamento não encontrado');

  return {
    agendamento: {
      id: agendamento.id,
      tipoNome: agendamento.tipoEvento.nome,
      dataHora: agendamento.dataHora,
      status: agendamento.status,
      documentoBase64: agendamento.documentoBase64,
      investidorNome: agendamento.investidor.nome,
      investidorCpf: agendamento.investidor.cpf,
      acompanhantes: (agendamento.acompanhantes ?? []).map((a) => ({
        nome: a.nome,
        documentoBase64: a.documentoBase64
      }))
    },
    unidade: {
      id: agendamento.unidade.id,
      numero: agendamento.unidade.numero,
      bloco: agendamento.unidade.bloco,
      empreendimento: agendamento.unidade.empreendimento.nome,
      status: agendamento.unidade.status,
      investidores: (agendamento.unidade.investidores ?? []).map((vi) => vi.investidor.nome)
    }
  };
}

export const actions = {
  confirmar: async ({ params, locals }) => {
    const agendamento = await db.agendamento.findUnique({
      where: { id: params.id },
      include: { tipoEvento: true, investidor: true }
    });
    if (!agendamento) return fail(404, { erro: 'Agendamento não encontrado.' });
    if (agendamento.status !== 'confirmado') {
      return fail(400, { erro: 'Este agendamento não está mais em aberto.' });
    }

    await db.agendamento.update({ where: { id: params.id }, data: { status: 'realizado' } });
    await db.historicoUnidade.create({
      data: {
        unidadeId: agendamento.unidadeId,
        tipo: 'evento_realizado',
        descricao: 'Check-in realizado',
        criadoPorId: locals.funcionario.id
      }
    });

    // avisa o investidor que a pesquisa de satisfação já está liberada
    const emailInvestidor = await emailDoInvestidorNaUnidade(agendamento.investidorId, agendamento.unidadeId);
    await notificarInvestidor({
      investidorId: agendamento.investidorId,
      titulo: 'Como foi sua visita?',
      mensagem: `Conta pra gente como foi o(a) "${agendamento.tipoEvento.nome}".`,
      link: `/agendamentos/${agendamento.id}`,
      email: emailInvestidor
        ? {
            to: emailInvestidor,
            subject: 'Como foi sua visita? — Calper',
            html: templatePesquisaDisponivel({
              nomeInvestidor: agendamento.investidor.nome,
              tipoNome: agendamento.tipoEvento.nome,
              agendamentoId: agendamento.id
            })
          }
        : null
    });

    return { sucesso: true };
  }
};