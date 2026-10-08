import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';

// Marca que o investidor já viu o tutorial de boas-vindas — chamado assim que
// o tutorial abre (pular ou terminar dão no mesmo: não aparece de novo).
export async function POST({ locals }) {
  if (!locals.investidor) throw error(401, 'Não autenticado.');

  await db.investidor.update({
    where: { id: locals.investidor.id },
    data: { tutorialVisto: true }
  });

  return json({ sucesso: true });
}