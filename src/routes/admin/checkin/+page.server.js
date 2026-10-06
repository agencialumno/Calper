import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';

export async function load({ url }) {
  const q = url.searchParams.get('q')?.trim() ?? '';
  if (!q) return { q, resultados: [] };

  // tenta primeiro como QR Code exato — some direto pro check-in
  const porToken = await db.agendamento.findUnique({ where: { qrToken: q } });
  if (porToken) throw redirect(303, `/admin/checkin/${porToken.id}`);

  // senão, busca por unidade/bloco/empreendimento e lista os agendamentos em aberto
  const unidades = await db.unidade.findMany({
    where: {
      OR: [
        { numero: { contains: q, mode: 'insensitive' } },
        { bloco: { contains: q, mode: 'insensitive' } },
        { empreendimento: { nome: { contains: q, mode: 'insensitive' } } }
      ]
    },
    include: {
      empreendimento: true,
      agendamentos: {
        where: { status: 'confirmado' },
        include: { tipoEvento: true },
        orderBy: { dataHora: 'asc' }
      }
    },
    take: 10
  });

  const resultados = unidades.flatMap((u) =>
    u.agendamentos.map((a) => ({
      agendamentoId: a.id,
      unidade: `${u.numero} — Bloco ${u.bloco}`,
      empreendimento: u.empreendimento.nome,
      tipoNome: a.tipoEvento.nome,
      dataHora: a.dataHora
    }))
  );

  return { q, resultados };
}