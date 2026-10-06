import { error, fail } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';

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
      acompanhantes: agendamento.acompanhantes.map((a) => a.nome)
    },
    unidade: {
      id: agendamento.unidade.id,
      numero: agendamento.unidade.numero,
      bloco: agendamento.unidade.bloco,
      empreendimento: agendamento.unidade.empreendimento.nome,
      status: agendamento.unidade.status,
      investidores: agendamento.unidade.investidores.map((vi) => vi.investidor.nome)
    }
  };
}

export const actions = {
  confirmar: async ({ params, locals }) => {
    const agendamento = await db.agendamento.findUnique({ where: { id: params.id } });
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

    return { sucesso: true };
  }
};