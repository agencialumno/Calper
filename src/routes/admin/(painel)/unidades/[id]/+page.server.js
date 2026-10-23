import { error, fail } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { registrarLog, rotuloFuncionario } from '$lib/server/log.js';
import { quartosDaUnidade } from '$lib/server/documentos.js';
import { statusDaUnidade } from '$lib/server/unidadeStatus.js';
import { podeEditar } from '$lib/perfis.js';

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

export async function load({ params, locals }) {
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

  // documentos assinados cujo agendamento foi apagado ficam guardados, ligados à unidade
  const documentosSoltos = await db.documentoAssinado.findMany({
    where: { unidadeId: params.id, agendamentoId: null },
    select: { id: true, tipo: true, status: true, assinadoEm: true, createdAt: true },
    orderBy: { createdAt: 'desc' }
  });

  return {
    podeEditar: podeEditar(locals.funcionario.perfil),
    documentosSoltos,
    unidade: {
      id: unidade.id,
      numero: unidade.numero,
      bloco: unidade.bloco,
      status: unidade.status,
      observacoes: unidade.observacoes,
      quartos: quartosDaUnidade(unidade),
      // mesmas etiquetas do cartão das abas Unidades e Chaves (tipologia, grupo, quitação, vistoria, escritura + "ver mais")
      ...statusDaUnidade(unidade),
      compradores: Array.isArray(unidade.compradores) ? unidade.compradores : [],
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
