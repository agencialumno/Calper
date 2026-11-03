import { db } from '$lib/server/db.js';
import { buscarMurano } from '$lib/server/entregaChaves.js';
import { statusDaUnidade } from '$lib/server/unidadeStatus.js';
import { podeEditar } from '$lib/perfis.js';
import { SLUG_VISTORIA } from '$lib/servicos.js';
import { rotuloDaVistoria } from '$lib/vistoria.js';

// Lista dos agendamentos de vistoria (mesma estrutura da aba Chaves); "Iniciar atendimento" abre /admin/vistoria/[id].
export async function load({ locals }) {
  const murano = await buscarMurano();
  if (!murano) return { agendamentos: [], semMurano: true };

  const agendamentos = await db.agendamento.findMany({
    where: { tipoEvento: { slug: SLUG_VISTORIA }, unidade: { empreendimentoId: murano.id } },
    include: { unidade: true },
    orderBy: { dataHora: 'asc' }
  });

  return {
    semMurano: false,
    podeEditar: podeEditar(locals.funcionario.perfil),
    agendamentos: agendamentos.map((a) => ({
      id: a.id,
      dataHora: a.dataHora,
      status: a.status,
      canceladoEm: a.canceladoEm,
      motivoCancelamento: a.motivoCancelamento,
      vistoriaNumero: a.vistoriaNumero,
      origem: a.origem,
      resultado: a.vistoriaResultado,
      resultadoRotulo: rotuloDaVistoria(a),
      nome: a.nomeCompareceu,
      telefone: a.telefoneCompareceu,
      email: a.emailCompareceu,
      ehProprietario: a.ehProprietario,
      proprietarioNome: a.proprietarioNome,
      unidade: { bloco: a.unidade.bloco, numero: a.unidade.numero, ...statusDaUnidade(a.unidade) }
    }))
  };
}
