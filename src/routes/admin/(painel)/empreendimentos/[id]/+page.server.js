import { error, fail } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { arquivoParaBase64 } from '$lib/server/agendamento.js';
import { notificarInvestidor } from '$lib/server/notificacao.js';
import { registrarLog, rotuloFuncionario } from '$lib/server/log.js';

const paraInputData = (d) => (d ? d.toISOString().slice(0, 10) : '');

// meio-dia evita que o fuso horário empurre a data pro dia anterior/seguinte
function lerData(valor) {
  if (!valor) return null;
  const d = new Date(`${valor}T12:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export async function load({ params }) {
  const e = await db.empreendimento.findUnique({ where: { id: params.id } });
  if (!e) throw error(404, 'Empreendimento não encontrado');

  return {
    empreendimento: {
      id: e.id,
      nome: e.nome,
      temBanner: Boolean(e.bannerImagemBase64),
      dataLancamento: paraInputData(e.dataLancamento),
      dataEntregaPrevista: paraInputData(e.dataEntregaPrevista),
      progressoPercentual: e.progressoPercentual,
      jornadaTitulo: e.jornadaTitulo ?? '',
      jornadaConteudo: e.jornadaConteudo ?? ''
    }
  };
}

export const actions = {
  default: async (event) => {
    const { request, params, locals } = event;
    const atual = await db.empreendimento.findUnique({ where: { id: params.id } });
    if (!atual) return fail(404, { erro: 'Empreendimento não encontrado.' });

    const form = await request.formData();

    const dataLancamento = lerData(String(form.get('dataLancamento') ?? ''));
    const dataEntregaPrevista = lerData(String(form.get('dataEntregaPrevista') ?? ''));
    if (dataLancamento === undefined || dataEntregaPrevista === undefined) {
      return fail(400, { erro: 'Data inválida.' });
    }

    const progresso = Number(form.get('progressoPercentual'));
    if (!Number.isInteger(progresso) || progresso < 0 || progresso > 100) {
      return fail(400, { erro: 'O progresso precisa ser um número inteiro de 0 a 100.' });
    }

    const data = {
      dataLancamento,
      dataEntregaPrevista,
      progressoPercentual: progresso,
      jornadaTitulo: String(form.get('jornadaTitulo') ?? '').trim() || null,
      jornadaConteudo: String(form.get('jornadaConteudo') ?? '').trim() || null
    };

    const arquivo = form.get('banner');
    if (arquivo && typeof arquivo !== 'string' && arquivo.size > 0) {
      if (!['image/jpeg', 'image/png'].includes(arquivo.type)) {
        return fail(400, { erro: 'O banner precisa ser JPG ou PNG.' });
      }
      try {
        data.bannerImagemBase64 = await arquivoParaBase64(arquivo);
      } catch (err) {
        return fail(400, { erro: err.message });
      }
    } else if (form.get('removerBanner') === 'on') {
      data.bannerImagemBase64 = null;
    }

    await db.empreendimento.update({ where: { id: params.id }, data });

    // progresso mudou: avisa todos os investidores com unidade no empreendimento
    let notificados = 0;
    if (progresso !== atual.progressoPercentual) {
      const vinculos = await db.unidadeInvestidor.findMany({
        where: { unidade: { empreendimentoId: params.id } },
        select: { investidorId: true },
        distinct: ['investidorId']
      });
      await Promise.all(
        vinculos.map((v) =>
          notificarInvestidor({
            investidorId: v.investidorId,
            titulo: 'Novidade na obra do seu empreendimento',
            mensagem: `O ${atual.nome} avançou: a obra está em ${progresso}%.`,
            link: '/jornada'
          })
        )
      );
      notificados = vinculos.length;
    }

    await registrarLog({
      event,
      atorTipo: 'funcionario',
      acao: 'empreendimento_editado',
      descricao: `${rotuloFuncionario(locals.funcionario)} editou o empreendimento ${atual.nome}${
        progresso !== atual.progressoPercentual
          ? ` — progresso ${atual.progressoPercentual}% → ${progresso}% (${notificados} investidor(es) notificado(s))`
          : ''
      }`,
      entidadeTipo: 'Empreendimento',
      entidadeId: params.id
    });

    return { sucesso: true, notificados };
  }
};
