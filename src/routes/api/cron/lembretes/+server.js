// Disparado uma vez por dia pelo Vercel Cron (ver vercel.json) — manda o
// lembrete da véspera pra quem tem agendamento confirmado pra amanhã.
// Protegido pelo CRON_SECRET: a Vercel manda automaticamente o header
// "Authorization: Bearer <CRON_SECRET>" quando essa env var está configurada.
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db.js';
import { notificarInvestidor, emailDoInvestidorNaUnidade } from '$lib/server/notificacao.js';
import { templateLembreteVisita } from '$lib/server/email.js';

export async function GET({ request }) {
  if (env.CRON_SECRET) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${env.CRON_SECRET}`) {
      return json({ erro: 'Não autorizado.' }, { status: 401 });
    }
  }

  const agora = new Date();
  const amanhaInicio = new Date(agora);
  amanhaInicio.setDate(amanhaInicio.getDate() + 1);
  amanhaInicio.setHours(0, 0, 0, 0);
  const amanhaFim = new Date(amanhaInicio);
  amanhaFim.setHours(23, 59, 59, 999);

  const agendamentos = await db.agendamento.findMany({
    where: {
      status: 'confirmado',
      lembreteEnviado: false,
      dataHora: { gte: amanhaInicio, lte: amanhaFim }
    },
    include: { tipoEvento: true, investidor: true, unidade: true }
  });

  let enviados = 0;
  for (const ag of agendamentos) {
    const data = ag.dataHora.toLocaleDateString('pt-BR');
    const horario = ag.dataHora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const emailInvestidor = await emailDoInvestidorNaUnidade(ag.investidorId, ag.unidadeId);

    await notificarInvestidor({
      investidorId: ag.investidorId,
      titulo: `Lembrete: ${ag.tipoEvento.nome} amanhã`,
      mensagem: `${data} às ${horario} — Unidade ${ag.unidade.numero} Bloco ${ag.unidade.bloco}.`,
      link: `/agendamentos/${ag.id}`,
      email: emailInvestidor
        ? {
            to: emailInvestidor,
            subject: `Lembrete — ${ag.tipoEvento.nome} amanhã`,
            html: templateLembreteVisita({
              nomeInvestidor: ag.investidor.nome,
              tipoNome: ag.tipoEvento.nome,
              unidade: `${ag.unidade.numero} — Bloco ${ag.unidade.bloco}`,
              data,
              horario
            })
          }
        : null
    });

    await db.agendamento.update({ where: { id: ag.id }, data: { lembreteEnviado: true } });
    enviados++;
  }

  return json({ sucesso: true, enviados });
}