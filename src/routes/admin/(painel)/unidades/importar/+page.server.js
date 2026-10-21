import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { registrarLog, rotuloFuncionario } from '$lib/server/log.js';
import { aplicarAtualizar, aplicarSobrescrever, lerPlanilha, montarPrevia, sanitizarUnidades } from '$lib/server/importarMurano.js';

// Importação da base de entrega de chaves (planilha .xlsx): primeiro uma PRÉVIA (não grava nada), depois a
// escolha explícita entre "Atualizar" (seguro, nunca apaga) e "Sobrescrever" (destrutivo, só perfil admin).
export const config = { maxDuration: 60 };

export function load({ locals }) {
  return { podeSobrescrever: locals.funcionario?.perfil === 'admin' };
}

const FRASE_SOBRESCREVER = 'SOBRESCREVER';

export const actions = {
  previa: async ({ request }) => {
    const form = await request.formData();
    const arquivo = form.get('arquivo');
    if (!arquivo || typeof arquivo === 'string' || arquivo.size === 0) {
      return fail(400, { erro: 'Escolha a planilha (.xlsx) da base de entrega de chaves.' });
    }
    if (!/\.xlsx$/i.test(arquivo.name)) return fail(400, { erro: 'O arquivo precisa ser uma planilha Excel (.xlsx).' });

    let leitura;
    try {
      leitura = await lerPlanilha(Buffer.from(await arquivo.arrayBuffer()));
    } catch (err) {
      return fail(400, { erro: err.message });
    }
    const previa = await montarPrevia(leitura.unidades);
    return {
      previa,
      leitura: { avisos: leitura.avisos, erros: leitura.erros, colunasFaltando: leitura.colunasFaltando, linhasLidas: leitura.linhasLidas },
      nomeArquivo: arquivo.name,
      // a confirmação devolve estes dados e o servidor revalida tudo; o hash garante que nada mudou desde a prévia
      unidadesJson: JSON.stringify(leitura.unidades.map(({ origens, ...u }) => u))
    };
  },

  aplicar: async (event) => {
    const { request, locals } = event;
    const form = await request.formData();
    const modo = String(form.get('modo') ?? '');
    const nomeArquivo = String(form.get('nomeArquivo') ?? 'planilha.xlsx').slice(0, 200);
    if (!['atualizar', 'sobrescrever'].includes(modo)) return fail(400, { erro: 'Escolha entre "Atualizar" e "Sobrescrever".' });

    let unidades;
    try {
      unidades = sanitizarUnidades(JSON.parse(String(form.get('unidadesJson') ?? '[]')));
    } catch (err) {
      return fail(400, { erro: `${err.message} Gere a prévia de novo.` });
    }

    if (modo === 'sobrescrever') {
      if (locals.funcionario.perfil !== 'admin') return fail(403, { erro: 'Só o perfil admin pode sobrescrever a base.' });
      if (String(form.get('confirmacao') ?? '').trim() !== FRASE_SOBRESCREVER || form.get('entendi') !== 'on') {
        return fail(400, { erro: `Para sobrescrever, marque a caixa de ciência e digite ${FRASE_SOBRESCREVER}.` });
      }
    }

    // a base pode ter mudado entre a prévia e a confirmação: confere antes de gravar qualquer coisa
    const atual = await montarPrevia(unidades);
    if (atual.hash !== String(form.get('previaHash') ?? '')) {
      return fail(409, { erro: 'Os dados mudaram desde que a prévia foi gerada (alguém agendou ou editou algo). Nada foi alterado: gere a prévia de novo.' });
    }

    const opcoes = { funcionarioId: locals.funcionario.id, nomeArquivo };
    const resultado = modo === 'sobrescrever' ? await aplicarSobrescrever(unidades, opcoes) : await aplicarAtualizar(unidades, opcoes);

    await db.importacaoLote.create({
      data: {
        nomeArquivo,
        totalLinhas: unidades.length,
        unidadesCriadas: resultado.criadas,
        investidoresCriados: 0,
        erros: { modo, atualizadas: resultado.atualizadas, apagado: modo === 'sobrescrever' ? atual.apagar : null },
        criadoPorId: locals.funcionario.id
      }
    });
    await registrarLog({
      event,
      atorTipo: 'funcionario',
      acao: modo === 'sobrescrever' ? 'base_sobrescrita' : 'base_atualizada',
      descricao:
        modo === 'sobrescrever'
          ? `${rotuloFuncionario(locals.funcionario)} SOBRESCREVEU a base de entrega de chaves com "${nomeArquivo}": apagou ${atual.apagar.unidades} unidade(s), ${atual.apagar.agendamentos} agendamento(s), ${atual.apagar.investidores} investidor(es) e importou ${resultado.criadas} unidade(s)`
          : `${rotuloFuncionario(locals.funcionario)} atualizou a base de entrega de chaves com "${nomeArquivo}": ${resultado.criadas} criada(s), ${resultado.atualizadas} atualizada(s), ${resultado.iguais} sem mudança`,
      entidadeTipo: 'ImportacaoLote'
    });

    return { resultado, nomeArquivo };
  }
};
