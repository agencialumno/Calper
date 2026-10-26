import { db } from '$lib/server/db.js';
import { SLUG_ENTREGA_CHAVES, buscarMurano } from '$lib/server/entregaChaves.js';
import { statusDaUnidade } from '$lib/server/unidadeStatus.js';
import { podeEditar } from '$lib/perfis.js';
import { fail } from '@sveltejs/kit';
import { iniciarAtendimentoDireto } from '$lib/server/atendimentoDireto.js';

export async function load({ locals }) {
  const murano = await buscarMurano();
  if (!murano) return { agendamentos: [], semMurano: true };

  const agendamentos = await db.agendamento.findMany({
    where: {
      tipoEvento: { slug: SLUG_ENTREGA_CHAVES },
      unidade: { empreendimentoId: murano.id }
    },
    include: { unidade: true, documentosAssinados: { select: { tipo: true, status: true } } },
    orderBy: { dataHora: 'asc' }
  });

  return {
    semMurano: false,
    podeEditar: podeEditar(locals.funcionario.perfil),
    agendamentos: agendamentos.map((a) => ({
      id: a.id,
      dataHora: a.dataHora,
      status: a.status,
      origem: a.origem,
      nome: a.nomeCompareceu,
      retiranteNome: a.retiranteNome,
      telefone: a.telefoneCompareceu,
      email: a.emailCompareceu,
      ehProprietario: a.ehProprietario,
      proprietarioNome: a.proprietarioNome,
      documentos: Object.fromEntries(a.documentosAssinados.map((d) => [d.tipo, d.status])),
      temProcuracao: Boolean(a.procuracaoBase64),
      unidade: {
        bloco: a.unidade.bloco,
        numero: a.unidade.numero,
        // as mesmas etiquetas e o mesmo "ver mais" da aba Unidades
        ...statusDaUnidade(a.unidade)
      }
    }))
  };
}

export const actions = {
  // Botão "Iniciar atendimento" das abas Unidades/dossiê: cria o atendimento direto (sem agendamento prévio) ou abre o
  // existente. Colaborador, supervisor e admin podem usar (a rota /admin/entrega-chaves já é de escrita do colaborador).
  iniciarDireto: async (event) => {
    const form = await event.request.formData();
    const r = await iniciarAtendimentoDireto(event, form.get('unidadeId')); // em caso de sucesso, redireciona
    return fail(400, { erro: r.erro });
  }
};
