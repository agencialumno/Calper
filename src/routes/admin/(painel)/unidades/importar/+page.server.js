import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { hashSenha, gerarSenhaTemporaria } from '$lib/server/auth.js';
import { cpfValido, somenteDigitos, emailValido } from '$lib/cpf.js';

export const actions = {
  confirmar: async ({ request, locals }) => {
    const form = await request.formData();
    const nomeArquivo = String(form.get('nomeArquivo') ?? 'planilha.csv');

    let linhas;
    try {
      linhas = JSON.parse(String(form.get('linhas') ?? '[]'));
    } catch {
      return fail(400, { erro: 'Não foi possível ler os dados enviados.' });
    }
    if (!Array.isArray(linhas) || linhas.length === 0) {
      return fail(400, { erro: 'Nenhuma linha válida para importar.' });
    }

    const erros = [];
    const credenciaisGeradas = [];
    let unidadesCriadas = 0;
    let investidoresCriados = 0;

    // Agrupa as linhas por unidade (empreendimento + bloco + número),
    // já que uma unidade pode ter até 3 linhas (uma por investidor).
    const grupos = new Map();
    for (const [i, linha] of linhas.entries()) {
      const empreendimento = String(linha.empreendimento ?? '').trim();
      const bloco = String(linha.bloco ?? '').trim();
      const numero = String(linha.numero ?? '').trim();
      const nome = String(linha.investidorNome ?? '').trim();
      const cpf = somenteDigitos(linha.investidorCpf);
      const email = String(linha.investidorEmail ?? '').trim();

      const linhaNum = i + 2; // +1 cabeçalho, +1 índice base 1

      if (!empreendimento || !bloco || !numero) {
        erros.push({ linha: linhaNum, motivo: 'Empreendimento, bloco ou número ausente.' });
        continue;
      }
      if (!nome) {
        erros.push({ linha: linhaNum, motivo: 'Nome do investidor ausente.' });
        continue;
      }
      if (!cpfValido(cpf)) {
        erros.push({ linha: linhaNum, motivo: `CPF inválido: ${linha.investidorCpf}` });
        continue;
      }
      if (!emailValido(email)) {
        erros.push({ linha: linhaNum, motivo: `E-mail inválido: ${linha.investidorEmail}` });
        continue;
      }

      const chave = `${empreendimento}::${bloco}::${numero}`;
      if (!grupos.has(chave)) grupos.set(chave, { empreendimento, bloco, numero, investidores: [] });
      const grupo = grupos.get(chave);
      if (grupo.investidores.length >= 3) {
        erros.push({ linha: linhaNum, motivo: 'Unidade já tem 3 investidores — linha ignorada.' });
        continue;
      }
      if (grupo.investidores.some((inv) => inv.cpf === cpf)) {
        erros.push({ linha: linhaNum, motivo: 'CPF duplicado para a mesma unidade.' });
        continue;
      }
      grupo.investidores.push({ nome, cpf, email });
    }

    for (const grupo of grupos.values()) {
      try {
        await db.$transaction(async (tx) => {
          let empreendimento = await tx.empreendimento.findFirst({
            where: { nome: { equals: grupo.empreendimento, mode: 'insensitive' } }
          });
          if (!empreendimento) {
            empreendimento = await tx.empreendimento.create({ data: { nome: grupo.empreendimento } });
          }

          let unidade = await tx.unidade.findFirst({
            where: { empreendimentoId: empreendimento.id, bloco: grupo.bloco, numero: grupo.numero }
          });
          const unidadeJaExistia = Boolean(unidade);
          if (!unidade) {
            unidade = await tx.unidade.create({
              data: { empreendimentoId: empreendimento.id, bloco: grupo.bloco, numero: grupo.numero }
            });
            unidadesCriadas++;
          }

          for (const inv of grupo.investidores) {
            let investidor = await tx.investidor.findUnique({ where: { cpf: inv.cpf } });
            if (!investidor) {
              const senhaTemporaria = gerarSenhaTemporaria();
              investidor = await tx.investidor.create({
                data: {
                  nome: inv.nome,
                  cpf: inv.cpf,
                  senhaHash: hashSenha(senhaTemporaria),
                  primeiroAcesso: true
                }
              });
              investidoresCriados++;
              credenciaisGeradas.push({ nome: inv.nome, cpf: inv.cpf, email: inv.email, senhaTemporaria });
            }

            const vinculoExistente = await tx.unidadeInvestidor.findFirst({
              where: { unidadeId: unidade.id, investidorId: investidor.id }
            });
            if (!vinculoExistente) {
              await tx.unidadeInvestidor.create({
                data: { unidadeId: unidade.id, investidorId: investidor.id, email: inv.email }
              });
            }
          }

          if (!unidadeJaExistia) {
            await tx.historicoUnidade.create({
              data: {
                unidadeId: unidade.id,
                tipo: 'cadastro',
                descricao: 'Unidade cadastrada via importação em massa',
                criadoPorId: locals.funcionario.id
              }
            });
          }
        });
      } catch (err) {
        erros.push({
          linha: null,
          motivo: `Unidade ${grupo.numero} — Bloco ${grupo.bloco} (${grupo.empreendimento}): ${err?.message ?? 'erro desconhecido'}`
        });
      }
    }

    const lote = await db.importacaoLote.create({
      data: {
        nomeArquivo,
        totalLinhas: linhas.length,
        unidadesCriadas,
        investidoresCriados,
        erros,
        credenciais: credenciaisGeradas,
        criadoPorId: locals.funcionario.id
      }
    });

    return {
      sucesso: true,
      loteId: lote.id,
      unidadesCriadas,
      investidoresCriados,
      erros,
      credenciais: credenciaisGeradas
    };
  }
};
