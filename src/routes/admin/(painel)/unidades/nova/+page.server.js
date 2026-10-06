import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { hashSenha, gerarSenhaTemporaria } from '$lib/server/auth.js';
import { cpfValido, somenteDigitos, emailValido } from '$lib/cpf.js';

export async function load() {
  const empreendimentos = await db.empreendimento.findMany({ orderBy: { nome: 'asc' } });
  return { empreendimentos };
}

export const actions = {
  default: async ({ request, locals }) => {
    const form = await request.formData();

    const empreendimentoId = String(form.get('empreendimentoId') ?? '');
    const novoEmpreendimentoNome = String(form.get('novoEmpreendimentoNome') ?? '').trim();
    const bloco = String(form.get('bloco') ?? '').trim();
    const numero = String(form.get('numero') ?? '').trim();

    const nomes = form.getAll('investidorNome').map(String);
    const cpfs = form.getAll('investidorCpf').map(String);
    const emails = form.getAll('investidorEmail').map(String);

    if (!bloco || !numero) {
      return fail(400, { erro: 'Informe bloco e número da unidade.' });
    }
    if (!empreendimentoId && !novoEmpreendimentoNome) {
      return fail(400, { erro: 'Selecione um empreendimento ou cadastre um novo.' });
    }

    const investidoresForm = nomes
      .map((nome, i) => ({ nome: nome.trim(), cpf: somenteDigitos(cpfs[i]), email: emails[i]?.trim() }))
      .filter((r) => r.nome || r.cpf || r.email);

    if (investidoresForm.length === 0) {
      return fail(400, { erro: 'Cadastre pelo menos um investidor para a unidade.' });
    }
    if (investidoresForm.length > 3) {
      return fail(400, { erro: 'Uma unidade pode ter no máximo 3 investidores.' });
    }
    for (const inv of investidoresForm) {
      if (!inv.nome) return fail(400, { erro: 'Falta o nome de um dos investidores.' });
      if (!cpfValido(inv.cpf)) return fail(400, { erro: `CPF inválido: ${inv.cpf}` });
      if (!emailValido(inv.email)) return fail(400, { erro: `E-mail inválido para ${inv.nome}.` });
    }

    try {
      const credenciaisGeradas = [];

      const resultado = await db.$transaction(async (tx) => {
        let empreendimento;
        if (empreendimentoId) {
          empreendimento = await tx.empreendimento.findUnique({ where: { id: empreendimentoId } });
          if (!empreendimento) throw new Error('Empreendimento não encontrado.');
        } else {
          empreendimento = await tx.empreendimento.create({ data: { nome: novoEmpreendimentoNome } });
        }

        const unidade = await tx.unidade.create({
          data: { empreendimentoId: empreendimento.id, bloco, numero }
        });

        for (const inv of investidoresForm) {
          let investidor = await tx.investidor.findUnique({ where: { cpf: inv.cpf } });
          if (!investidor) {
            const senhaTemporaria = gerarSenhaTemporaria();
            investidor = await tx.investidor.create({
              data: { nome: inv.nome, cpf: inv.cpf, senhaHash: hashSenha(senhaTemporaria), primeiroAcesso: true }
            });
            credenciaisGeradas.push({ nome: inv.nome, cpf: inv.cpf, email: inv.email, senhaTemporaria });
          }
          await tx.unidadeInvestidor.create({
            data: { unidadeId: unidade.id, investidorId: investidor.id, email: inv.email }
          });
        }

        await tx.historicoUnidade.create({
          data: {
            unidadeId: unidade.id,
            tipo: 'cadastro',
            descricao: 'Unidade cadastrada manualmente no sistema',
            criadoPorId: locals.funcionario.id
          }
        });

        return unidade;
      });

      if (credenciaisGeradas.length) {
        // Guarda as senhas temporárias geradas pra exibir uma única vez na tela seguinte.
        return {
          sucesso: true,
          unidadeId: resultado.id,
          credenciais: credenciaisGeradas
        };
      }

      throw redirect(303, `/admin/unidades/${resultado.id}`);
    } catch (err) {
      if (err?.status === 303) throw err;
      if (err?.code === 'P2002') {
        return fail(400, { erro: 'Já existe uma unidade com esse bloco/número nesse empreendimento.' });
      }
      return fail(400, { erro: err?.message ?? 'Não foi possível cadastrar a unidade.' });
    }
  }
};
