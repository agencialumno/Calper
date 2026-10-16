import { error, fail } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { registrarLog, rotuloFuncionario } from '$lib/server/log.js';
import { quartosDaUnidade } from '$lib/server/documentos.js';

async function logUnidade(event, acao, texto) {
  const u = await db.unidade.findUnique({ where: { id: event.params.id }, select: { numero: true, bloco: true } });
  await registrarLog({
    event,
    atorTipo: 'funcionario',
    acao,
    descricao: `${rotuloFuncionario(event.locals.funcionario)} ${texto} — Unidade ${u?.numero}, Bloco ${u?.bloco}`,
    entidadeTipo: 'Unidade',
    entidadeId: event.params.id
  });
}

export async function load({ params }) {
  const unidade = await db.unidade.findUnique({
    where: { id: params.id },
    include: {
      empreendimento: true,
      investidores: { include: { investidor: true } },
      historico: { orderBy: { createdAt: 'desc' } },
      agendamentos: { include: { tipoEvento: true, documentosAssinados: { select: { tipo: true, status: true } }, presencas: { orderBy: { createdAt: 'asc' } } }, orderBy: { dataHora: 'desc' } }
    }
  });

  if (!unidade) throw error(404, 'Unidade não encontrada');

  // sem o arquivo (base64 pesado): ele só é lido na rota de download
  const procuracoes = await db.procuracaoUnidade.findMany({
    where: { unidadeId: params.id },
    select: { id: true, nome: true, cpf: true, origem: true, createdAt: true },
    orderBy: { createdAt: 'desc' }
  });

  return {
    unidade: {
      id: unidade.id,
      numero: unidade.numero,
      bloco: unidade.bloco,
      status: unidade.status,
      observacoes: unidade.observacoes,
      quartos: quartosDaUnidade(unidade),
      tipologia: unidade.tipologia,
      grupo: unidade.grupo,
      statusQuitacao: unidade.statusQuitacao,
      compradores: Array.isArray(unidade.compradores) ? unidade.compradores : [],
      financiado: unidade.financiado,
      grupoFinanciamento: unidade.grupoFinanciamento,
      vistoriaAprovada: unidade.vistoriaAprovada,
      escrituraRegistrada: unidade.escrituraRegistrada,
      empreendimento: unidade.empreendimento.nome,
      createdAt: unidade.createdAt,
      procuracoes,
      investidores: unidade.investidores.map((vi) => ({
        investidorId: vi.investidorId,
        nome: vi.investidor.nome,
        cpf: vi.investidor.cpf,
        email: vi.email,
        primeiroAcesso: vi.investidor.primeiroAcesso
      })),
      historico: unidade.historico.map((h) => ({
        id: h.id,
        tipo: h.tipo,
        descricao: h.descricao,
        createdAt: h.createdAt
      })),
      agendamentos: unidade.agendamentos.map((a) => ({
        id: a.id,
        tipoNome: a.tipoEvento.nome,
        ehEntregaChaves: a.tipoEvento.slug === 'entrega-chaves',
        agendadoPor: a.nomeCompareceu,
        retirante: a.retiranteNome
          ? { nome: a.retiranteNome, vinculo: a.presencas.find((p) => p.vinculo !== 'acompanhante')?.vinculo ?? null }
          : null,
        dataHora: a.dataHora,
        status: a.status,
        documentos: a.documentosAssinados.map((d) => ({ tipo: d.tipo, status: d.status })),
        presencas: a.presencas.map((p) => ({ id: p.id, nome: p.nome, vinculo: p.vinculo, createdAt: p.createdAt }))
      }))
    }
  };
}

export const actions = {
  atualizarStatus: async (event) => {
    const { request, params, locals } = event;
    const form = await request.formData();
    const status = String(form.get('status') ?? '');
    if (!['regularizado', 'troca_titularidade', 'distrato'].includes(status)) {
      return fail(400, { erro: 'Status inválido.' });
    }

    await db.unidade.update({ where: { id: params.id }, data: { status } });
    await db.historicoUnidade.create({
      data: {
        unidadeId: params.id,
        tipo: 'outro',
        descricao: `Status da unidade alterado para "${status.replace('_', ' ')}"`,
        criadoPorId: locals.funcionario.id
      }
    });
    await logUnidade(event, 'unidade_editada', `alterou o status da unidade para "${status.replace('_', ' ')}"`);
    return { sucesso: true };
  },

  atualizarTipologia: async (event) => {
    const { request, params, locals } = event;
    const form = await request.formData();
    const bruto = String(form.get('quartos') ?? '').trim();
    const quartos = bruto === '' ? null : Number(bruto);
    if (quartos !== null && (!Number.isInteger(quartos) || quartos < 1 || quartos > 10)) {
      return fail(400, { erro: 'Número de quartos inválido.' });
    }

    await db.unidade.update({ where: { id: params.id }, data: { quartos } });
    await db.historicoUnidade.create({
      data: {
        unidadeId: params.id,
        tipo: 'outro',
        descricao: `Tipologia atualizada: ${quartos ?? 'não informada'} quarto(s)`,
        criadoPorId: locals.funcionario.id
      }
    });
    await logUnidade(event, 'unidade_editada', `atualizou a tipologia para ${quartos ?? 'não informada'} quarto(s)`);
    return { sucesso: true };
  },

  atualizarFinanceiroJuridico: async (event) => {
    const { request, params, locals } = event;
    const form = await request.formData();
    const statusQuitacao = String(form.get('statusQuitacao') ?? '') || null;
    const financiado = form.get('financiado') === 'on';
    const grupoBruto = String(form.get('grupoFinanciamento') ?? '');
    const vistoriaAprovada = form.get('vistoriaAprovada') === 'on';
    const escrituraRegistrada = form.get('escrituraRegistrada') === 'on';

    if (statusQuitacao !== null && !['quitada', 'a_vencer'].includes(statusQuitacao)) {
      return fail(400, { erro: 'Status de pagamento inválido.' });
    }
    if (financiado && !['A', 'B'].includes(grupoBruto)) {
      return fail(400, { erro: 'Unidade financiada precisa de grupo A ou B.' });
    }
    const grupoFinanciamento = financiado ? grupoBruto : null;

    await db.unidade.update({
      where: { id: params.id },
      data: { statusQuitacao, financiado, grupoFinanciamento, vistoriaAprovada, escrituraRegistrada }
    });
    await db.historicoUnidade.create({
      data: {
        unidadeId: params.id,
        tipo: 'outro',
        descricao: `Status financeiro/jurídico atualizado: pagamento ${statusQuitacao ?? 'não informado'}, ${
          financiado ? `financiada (grupo ${grupoFinanciamento})` : 'não financiada'
        }, vistoria ${vistoriaAprovada ? 'aprovada' : 'pendente'}, escritura ${
          escrituraRegistrada ? 'registrada' : 'não registrada'
        }`,
        criadoPorId: locals.funcionario.id
      }
    });
    await logUnidade(event, 'unidade_editada', `atualizou o status financeiro/jurídico (pagamento ${statusQuitacao ?? 'não informado'}, ${financiado ? 'financiada, grupo ' + grupoFinanciamento : 'não financiada'}, vistoria ${vistoriaAprovada ? 'aprovada' : 'pendente'}, escritura ${escrituraRegistrada ? 'registrada' : 'não registrada'})`);
    return { sucesso: true };
  },

  adicionarApontamento: async (event) => {
    const { request, params, locals } = event;
    const form = await request.formData();
    const descricao = String(form.get('descricao') ?? '').trim();
    const tipo = String(form.get('tipo') ?? 'apontamento');

    if (!descricao) return fail(400, { erro: 'Escreva uma descrição.' });

    await db.historicoUnidade.create({
      data: { unidadeId: params.id, tipo, descricao, criadoPorId: locals.funcionario.id }
    });
    await logUnidade(event, 'unidade_editada', `registrou ${tipo === 'apontamento' ? 'apontamento' : tipo}: "${descricao}"`);
    return { sucesso: true };
  },

  atualizarEmail: async (event) => {
    const { request, params, locals } = event;
    const form = await request.formData();
    const investidorId = String(form.get('investidorId') ?? '');
    const email = String(form.get('email') ?? '').trim();

    if (!investidorId) return fail(400, { erro: 'Investidor inválido.' });
    if (!email || !email.includes('@') || !email.includes('.')) {
      return fail(400, { erro: 'Informe um e-mail válido.' });
    }

    const vinculo = await db.unidadeInvestidor.findUnique({
      where: { unidadeId_investidorId: { unidadeId: params.id, investidorId } }
    });
    if (!vinculo) return fail(404, { erro: 'Vínculo não encontrado.' });

    await db.unidadeInvestidor.update({
      where: { unidadeId_investidorId: { unidadeId: params.id, investidorId } },
      data: { email }
    });

    await db.historicoUnidade.create({
      data: {
        unidadeId: params.id,
        tipo: 'outro',
        descricao: `E-mail de contato atualizado para ${email}`,
        criadoPorId: locals.funcionario.id
      }
    });

    await logUnidade(event, 'unidade_editada', `atualizou o e-mail de contato de um investidor para ${email}`);
    return { sucesso: true, emailAtualizado: true };
  }
};
