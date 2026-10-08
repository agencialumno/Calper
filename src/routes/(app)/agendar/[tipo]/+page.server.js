import { error, fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import {
  HORARIOS_DISPONIVEIS,
  arquivoParaBase64,
  faixaDeDatasPermitida,
  gerarQrToken,
  temAgendamentoAtivo
} from '$lib/server/agendamento.js';
import { horarioOcupado, criarEvento } from '$lib/server/googleCalendar.js';
import { notificarInvestidor, notificarFuncionarios, emailDoInvestidorNaUnidade } from '$lib/server/notificacao.js';
import { templateAgendamentoConfirmado } from '$lib/server/email.js';

export async function load({ params, locals }) {
  const tipoEvento = await db.tipoEvento.findUnique({ where: { slug: params.tipo } });
  if (!tipoEvento || !tipoEvento.ativo) throw error(404, 'Tipo de evento não encontrado');

  if (await temAgendamentoAtivo(locals.unidadeId, tipoEvento.id)) {
    throw redirect(303, '/painel');
  }

  const { minimo, maximo } = faixaDeDatasPermitida();

  return {
    tipoEvento: {
      slug: tipoEvento.slug,
      nome: tipoEvento.nome,
      exigeDocumento: tipoEvento.exigeDocumento,
      limitePessoas: tipoEvento.limitePessoas
    },
    horarios: HORARIOS_DISPONIVEIS,
    dataMinima: minimo.toISOString().slice(0, 10),
    dataMaxima: maximo.toISOString().slice(0, 10)
  };
}

export const actions = {
  default: async ({ request, params, locals }) => {
    const tipoEvento = await db.tipoEvento.findUnique({ where: { slug: params.tipo } });
    if (!tipoEvento || !tipoEvento.ativo) return fail(404, { erro: 'Tipo de evento inválido.' });

    // revalida a regra de bloqueio (proteção contra corrida/duplo clique)
    if (await temAgendamentoAtivo(locals.unidadeId, tipoEvento.id)) {
      return fail(400, { erro: 'Esta unidade já tem um agendamento ativo para este tipo de evento.' });
    }

    const form = await request.formData();
    const data = String(form.get('data') ?? '');
    const horario = String(form.get('horario') ?? '');

    const nomesAcompanhantes = form.getAll('acompanhanteNome').map((n) => String(n).trim());
    const documentosAcompanhantes = form.getAll('acompanhanteDocumento');

    const acompanhantesValidos = nomesAcompanhantes
      .map((nome, i) => ({ nome, documento: documentosAcompanhantes[i] }))
      .filter((a) => a.nome);

    const { minimo, maximo } = faixaDeDatasPermitida();
    const dataEscolhida = new Date(`${data}T00:00:00`);

    if (!data || Number.isNaN(dataEscolhida.getTime()) || dataEscolhida < minimo || dataEscolhida > maximo) {
      return fail(400, { erro: 'Escolha uma data válida dentro da janela disponível.' });
    }
    if (!HORARIOS_DISPONIVEIS.includes(horario)) {
      return fail(400, { erro: 'Escolha um horário válido.' });
    }

    const totalPessoas = 1 + acompanhantesValidos.length;
    if (totalPessoas > tipoEvento.limitePessoas) {
      return fail(400, {
        erro: `Este evento aceita no máximo ${tipoEvento.limitePessoas} pessoa(s), incluindo você.`
      });
    }

    let documentoBase64 = null;
    if (tipoEvento.exigeDocumento) {
      const arquivo = form.get('documento');
      try {
        documentoBase64 = await arquivoParaBase64(arquivo);
      } catch (err) {
        return fail(400, { erro: err.message });
      }
      if (!documentoBase64) {
        return fail(400, { erro: 'Envie o documento de identificação — obrigatório para este evento.' });
      }
    }

    let acompanhantesParaCriar;
    try {
      acompanhantesParaCriar = await Promise.all(
        acompanhantesValidos.map(async (a) => ({
          nome: a.nome,
          documentoBase64: await arquivoParaBase64(a.documento)
        }))
      );
    } catch (err) {
      return fail(400, { erro: `Documento de acompanhante inválido: ${err.message}` });
    }

    const [hora, minuto] = horario.split(':').map(Number);
    const dataHora = new Date(`${data}T00:00:00`);
    dataHora.setHours(hora, minuto, 0, 0);
    const dataHoraFim = new Date(dataHora.getTime() + 60 * 60 * 1000); // slots de 1h

    // checa a agenda real da Calper no Google Calendar — evita duas unidades
    // marcadas no mesmo horário (ex: dois grupos de visita ao mesmo tempo)
    if (await horarioOcupado(dataHora, dataHoraFim)) {
      return fail(400, {
        erro: 'Esse horário acabou de ficar indisponível na agenda da Calper. Escolha outro horário.'
      });
    }

    const agendamento = await db.agendamento.create({
      data: {
        unidadeId: locals.unidadeId,
        tipoEventoId: tipoEvento.id,
        investidorId: locals.investidor.id,
        dataHora,
        qrToken: gerarQrToken(),
        documentoBase64,
        acompanhantes: { create: acompanhantesParaCriar }
      }
    });

    await db.historicoUnidade.create({
      data: {
        unidadeId: locals.unidadeId,
        tipo: 'outro',
        descricao: `Agendamento de "${tipoEvento.nome}" criado para ${data} às ${horario}`
      }
    });

    // best-effort: se o Calendar não estiver configurado ou falhar, o
    // agendamento já foi salvo normalmente — não bloqueia o investidor
    const unidade = await db.unidade.findUnique({
      where: { id: locals.unidadeId },
      select: { numero: true, bloco: true }
    });
    const googleEventId = await criarEvento({
      titulo: `${tipoEvento.nome} — Unidade ${unidade?.numero} Bloco ${unidade?.bloco}`,
      descricao: `Investidor: ${locals.investidor.nome}${acompanhantesParaCriar.length ? ` + ${acompanhantesParaCriar.length} acompanhante(s)` : ''}`,
      inicio: dataHora,
      fim: dataHoraFim
    });
    if (googleEventId) {
      await db.agendamento.update({ where: { id: agendamento.id }, data: { googleEventId } });
    }

    // notifica o investidor (sino + e-mail, se tivermos um e-mail cadastrado
    // pra ele nessa unidade) e avisa o time Calper que entrou um agendamento novo
    const emailInvestidor = await emailDoInvestidorNaUnidade(locals.investidor.id, locals.unidadeId);
    await notificarInvestidor({
      investidorId: locals.investidor.id,
      titulo: `${tipoEvento.nome} confirmado`,
      mensagem: `Agendado para ${data} às ${horario}.`,
      link: `/agendamentos/${agendamento.id}`,
      email: emailInvestidor
        ? {
            to: emailInvestidor,
            subject: `Agendamento confirmado — ${tipoEvento.nome}`,
            html: templateAgendamentoConfirmado({
              nomeInvestidor: locals.investidor.nome,
              tipoNome: tipoEvento.nome,
              unidade: `${unidade?.numero} — Bloco ${unidade?.bloco}`,
              data,
              horario,
              agendamentoId: agendamento.id
            })
          }
        : null
    });

    await notificarFuncionarios({
      titulo: 'Novo agendamento',
      mensagem: `${locals.investidor.nome} marcou "${tipoEvento.nome}" para ${data} às ${horario} (Unidade ${unidade?.numero} — Bloco ${unidade?.bloco}).`,
      link: '/admin/checkin'
    });

    throw redirect(303, `/agendamentos/${agendamento.id}`);
  }
};