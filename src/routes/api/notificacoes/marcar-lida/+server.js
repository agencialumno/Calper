// Marca uma notificação (ou todas) como lida pro investidor ou funcionário
// logado — qual dos dois é decidido pela sessão, nunca pelo corpo da requisição.
import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';

export async function POST({ request, locals }) {
  if (!locals.investidor && !locals.funcionario) {
    return json({ erro: 'Não autenticado.' }, { status: 401 });
  }

  const campoId = locals.investidor ? 'investidorId' : 'funcionarioId';
  const meuId = locals.investidor ? locals.investidor.id : locals.funcionario.id;

  const { id, todas } = await request.json();

  if (todas) {
    await db.notificacao.updateMany({
      where: { [campoId]: meuId, lida: false },
      data: { lida: true }
    });
    return json({ sucesso: true });
  }

  if (!id) return json({ erro: 'Informe o id da notificação.' }, { status: 400 });

  // updateMany com o filtro de dono embutido: se a notificação não for
  // dessa pessoa, simplesmente não atualiza nada (sem vazar erro/existência).
  await db.notificacao.updateMany({
    where: { id, [campoId]: meuId },
    data: { lida: true }
  });

  return json({ sucesso: true });
}