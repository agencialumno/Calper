import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { listarNotificacoes } from '$lib/server/notificacao.js';

export async function load({ locals }) {
  if (!locals.investidor) throw redirect(303, '/login');
  if (locals.investidor.primeiroAcesso) throw redirect(303, '/primeiro-acesso');
  if (!locals.unidadeId) throw redirect(303, '/login/unidades');

  const [unidade, notificacoes, vinculos] = await Promise.all([
    db.unidade.findUnique({
      where: { id: locals.unidadeId },
      include: { empreendimento: true }
    }),
    listarNotificacoes({ investidorId: locals.investidor.id }),
    db.unidadeInvestidor.findMany({
      where: { investidorId: locals.investidor.id },
      include: { unidade: { include: { empreendimento: true } } }
    })
  ]);

  const vinculoAtual = vinculos.find((v) => v.unidadeId === locals.unidadeId);

  return {
    unidade: unidade
      ? {
          id: unidade.id,
          numero: unidade.numero,
          bloco: unidade.bloco,
          empreendimento: unidade.empreendimento.nome
        }
      : null,
    investidor: {
      nome: locals.investidor.nome,
      cpf: locals.investidor.cpf,
      email: vinculoAtual?.email ?? ''
    },
    unidades: vinculos.map((v) => ({
      id: v.unidade.id,
      numero: v.unidade.numero,
      bloco: v.unidade.bloco,
      empreendimento: v.unidade.empreendimento.nome
    })),
    notificacoes
  };
}