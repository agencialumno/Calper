import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { listarNotificacoes } from '$lib/server/notificacao.js';

export async function load({ locals }) {
  if (!locals.investidor) throw redirect(303, '/login');
  if (locals.investidor.primeiroAcesso) throw redirect(303, '/primeiro-acesso');
  if (!locals.unidadeId) throw redirect(303, '/login/unidades');

  const [unidade, notificacoes] = await Promise.all([
    db.unidade.findUnique({
      where: { id: locals.unidadeId },
      include: { empreendimento: true }
    }),
    listarNotificacoes({ investidorId: locals.investidor.id })
  ]);

  return {
    unidade: unidade
      ? {
          id: unidade.id,
          numero: unidade.numero,
          bloco: unidade.bloco,
          empreendimento: unidade.empreendimento.nome
        }
      : null,
    notificacoes
  };
}