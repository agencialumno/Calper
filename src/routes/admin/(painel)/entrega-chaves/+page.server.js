import { db } from '$lib/server/db.js';
import { SLUG_ENTREGA_CHAVES, buscarMurano } from '$lib/server/entregaChaves.js';
import { quartosDaUnidade } from '$lib/server/documentos.js';

export async function load() {
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
    agendamentos: agendamentos.map((a) => ({
      id: a.id,
      dataHora: a.dataHora,
      status: a.status,
      nome: a.nomeCompareceu,
      retiranteNome: a.retiranteNome,
      telefone: a.telefoneCompareceu,
      email: a.emailCompareceu,
      ehProprietario: a.ehProprietario,
      documentos: Object.fromEntries(a.documentosAssinados.map((d) => [d.tipo, d.status])),
      temProcuracao: Boolean(a.procuracaoBase64),
      unidade: {
        id: a.unidade.id,
        bloco: a.unidade.bloco,
        numero: a.unidade.numero,
        quartos: quartosDaUnidade(a.unidade), // tipologia da base Murano ("3 QUARTOS") ou o campo quartos
        statusQuitacao: a.unidade.statusQuitacao,
        financiado: a.unidade.financiado,
        grupoFinanciamento: a.unidade.grupoFinanciamento,
        vistoriaAprovada: a.unidade.vistoriaAprovada,
        escrituraRegistrada: a.unidade.escrituraRegistrada
      }
    }))
  };
}
