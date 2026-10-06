import { error, fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import {
  HORARIOS_DISPONIVEIS,
  arquivoParaBase64,
  faixaDeDatasPermitida,
  gerarQrToken,
  temAgendamentoAtivo
} from '$lib/server/agendamento.js';

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
    const acompanhantes = form
      .getAll('acompanhante')
      .map((n) => String(n).trim())
      .filter(Boolean);

    const { minimo, maximo } = faixaDeDatasPermitida();
    const dataEscolhida = new Date(`${data}T00:00:00`);

    if (!data || Number.isNaN(dataEscolhida.getTime()) || dataEscolhida < minimo || dataEscolhida > maximo) {
      return fail(400, { erro: 'Escolha uma data válida dentro da janela disponível.' });
    }
    if (!HORARIOS_DISPONIVEIS.includes(horario)) {
      return fail(400, { erro: 'Escolha um horário válido.' });
    }

    const totalPessoas = 1 + acompanhantes.length;
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

    const [hora, minuto] = horario.split(':').map(Number);
    const dataHora = new Date(`${data}T00:00:00`);
    dataHora.setHours(hora, minuto, 0, 0);

    const agendamento = await db.agendamento.create({
      data: {
        unidadeId: locals.unidadeId,
        tipoEventoId: tipoEvento.id,
        investidorId: locals.investidor.id,
        dataHora,
        qrToken: gerarQrToken(),
        documentoBase64,
        acompanhantes: { create: acompanhantes.map((nome) => ({ nome })) }
      }
    });

    await db.historicoUnidade.create({
      data: {
        unidadeId: locals.unidadeId,
        tipo: 'outro',
        descricao: `Agendamento de "${tipoEvento.nome}" criado para ${data} às ${horario}`
      }
    });

    throw redirect(303, `/agendamentos/${agendamento.id}`);
  }
};
