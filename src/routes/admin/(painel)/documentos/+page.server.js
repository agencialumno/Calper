import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { buscarMurano } from '$lib/server/entregaChaves.js';
import { obterTemplate } from '$lib/server/documentos.js';
import { TIPO_CHECKLIST, TIPO_TERMO, VARIAVEIS_EMPREENDIMENTO } from '$lib/documentosPadrao.js';

export async function load() {
  const murano = await buscarMurano();
  if (!murano) return { semMurano: true };

  const [termo, checklist] = await Promise.all([
    obterTemplate(murano.id, TIPO_TERMO),
    obterTemplate(murano.id, TIPO_CHECKLIST)
  ]);

  return {
    semMurano: false,
    empreendimento: murano.nome,
    termo: { conteudo: termo.conteudo, atualizadoEm: termo.atualizadoEm },
    checklist: { conteudo: checklist.conteudo, atualizadoEm: checklist.atualizadoEm },
    variaveis: VARIAVEIS_EMPREENDIMENTO.map((v) => ({
      ...v,
      valor: termo.variaveis?.[v.chave] ?? '',
      // valor provisório gravado como fictício até alguém informar o real
      ficticio: Array.isArray(termo.variaveis?.ficticias) && termo.variaveis.ficticias.includes(v.chave)
    }))
  };
}

export const actions = {
  salvarTexto: async ({ request }) => {
    const form = await request.formData();
    const tipo = String(form.get('tipo') ?? '');
    const conteudo = String(form.get('conteudo') ?? '').trim();
    if (![TIPO_TERMO, TIPO_CHECKLIST].includes(tipo)) return fail(400, { erro: 'Tipo inválido.' });
    if (!conteudo) return fail(400, { erro: 'O texto não pode ficar vazio.' });

    const murano = await buscarMurano();
    if (!murano) return fail(404, { erro: 'Empreendimento Murano não encontrado.' });
    await obterTemplate(murano.id, tipo);
    await db.documentoTemplate.update({
      where: { empreendimentoId_tipo: { empreendimentoId: murano.id, tipo } },
      data: { conteudo }
    });
    return { sucesso: tipo };
  },

  salvarVariaveis: async ({ request }) => {
    const form = await request.formData();
    const murano = await buscarMurano();
    if (!murano) return fail(404, { erro: 'Empreendimento Murano não encontrado.' });

    const termo = await obterTemplate(murano.id, TIPO_TERMO);
    const atuais = termo.variaveis ?? {};
    const variaveis = Object.fromEntries(
      VARIAVEIS_EMPREENDIMENTO.map((v) => [v.chave, String(form.get(v.chave) ?? '').trim()])
    );
    // o aviso "fictício" só some quando o valor é alterado (ou apagado)
    variaveis.ficticias = (Array.isArray(atuais.ficticias) ? atuais.ficticias : []).filter(
      (chave) => variaveis[chave] && variaveis[chave] === atuais[chave]
    );
    await db.documentoTemplate.update({
      where: { empreendimentoId_tipo: { empreendimentoId: murano.id, tipo: TIPO_TERMO } },
      data: { variaveis }
    });
    return { sucesso: 'variaveis' };
  }
};
