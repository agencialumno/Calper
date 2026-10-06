import { error, fail } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';

export async function load({ params }) {
  const unidade = await db.unidade.findUnique({
    where: { id: params.id },
    include: {
      empreendimento: true,
      investidores: { include: { investidor: true } },
      historico: { orderBy: { createdAt: 'desc' } }
    }
  });

  if (!unidade) throw error(404, 'Unidade não encontrada');

  return {
    unidade: {
      id: unidade.id,
      numero: unidade.numero,
      bloco: unidade.bloco,
      status: unidade.status,
      observacoes: unidade.observacoes,
      empreendimento: unidade.empreendimento.nome,
      createdAt: unidade.createdAt,
      investidores: unidade.investidores.map((vi) => ({
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
      }))
    }
  };
}

export const actions = {
  atualizarStatus: async ({ request, params, locals }) => {
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
    return { sucesso: true };
  },

  adicionarApontamento: async ({ request, params, locals }) => {
    const form = await request.formData();
    const descricao = String(form.get('descricao') ?? '').trim();
    const tipo = String(form.get('tipo') ?? 'apontamento');

    if (!descricao) return fail(400, { erro: 'Escreva uma descrição.' });

    await db.historicoUnidade.create({
      data: { unidadeId: params.id, tipo, descricao, criadoPorId: locals.funcionario.id }
    });
    return { sucesso: true };
  }
};
