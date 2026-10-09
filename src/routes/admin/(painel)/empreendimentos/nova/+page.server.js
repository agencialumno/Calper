import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { ETAPAS, ETAPA_PADRAO } from '$lib/etapas.js';

export function load() {
  return {
    etapas: ETAPAS.map((e) => ({ id: e.id, nome: e.nome, descricao: e.descricao })),
    etapaPadrao: ETAPA_PADRAO
  };
}

export const actions = {
  default: async ({ request }) => {
    const form = await request.formData();
    const nome = String(form.get('nome') ?? '').trim();
    const etapa = String(form.get('etapa') ?? '');

    if (!nome) return fail(400, { erro: 'Informe o nome do empreendimento.', nome, etapa });
    if (!ETAPAS.some((e) => e.id === etapa)) {
      return fail(400, { erro: 'Escolha a etapa atual do empreendimento.', nome, etapa });
    }

    const existente = await db.empreendimento.findFirst({
      where: { nome: { equals: nome, mode: 'insensitive' } }
    });
    if (existente) {
      return fail(400, { erro: 'Já existe um empreendimento com esse nome.', nome, etapa });
    }

    await db.empreendimento.create({
      data: {
        nome,
        etapa,
        estagioAtual: ETAPAS.find((e) => e.id === etapa).nome
      }
    });

    throw redirect(303, '/admin/unidades/nova');
  }
};
