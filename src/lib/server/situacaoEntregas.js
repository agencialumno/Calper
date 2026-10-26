import { db } from './db.js';
import { SLUG_ENTREGA_CHAVES } from './entregaChaves.js';

/**
 * Quem agendou a entrega de chaves dividido em dois grupos (agendamentos cancelados ficam de fora):
 *  - receberam: entrega concluída (termo e checklist assinados por todos), com a data da entrega;
 *  - faltam: agendaram e a entrega ainda não foi concluída (compareceu ou não), pra a equipe cobrar.
 * Filtros: q (nome, unidade, retirante, e-mail) e de/ate (data da entrega nos que receberam;
 * data agendada nos que faltam), no formato AAAA-MM-DD.
 */
export async function buscarSituacaoEntregas({ q = '', de = '', ate = '' } = {}) {
  const agendamentos = await db.agendamento.findMany({
    where: { tipoEvento: { slug: SLUG_ENTREGA_CHAVES }, status: { in: ['confirmado', 'realizado'] } },
    select: {
      id: true,
      status: true,
      origem: true,
      checkinEm: true,
      createdAt: true,
      dataHora: true,
      nomeCompareceu: true,
      cpfCompareceu: true,
      telefoneCompareceu: true,
      emailCompareceu: true,
      ehProprietario: true,
      proprietarioNome: true,
      retiranteNome: true,
      observacoesAtendimento: true,
      unidade: { select: { id: true, bloco: true, numero: true } },
      documentosAssinados: { select: { tipo: true, status: true, assinadoEm: true } },
      presencas: { select: { id: true } }
    }
  });

  const unidadesEntregues = new Set(agendamentos.filter((a) => a.status === 'realizado').map((a) => a.unidade.id));
  const item = (a) => ({
    agendamentoId: a.id,
    unidadeId: a.unidade.id,
    bloco: a.unidade.bloco,
    numero: a.unidade.numero,
    unidade: `Bloco ${a.unidade.bloco} - nº ${a.unidade.numero}`,
    agendouNome: a.nomeCompareceu,
    direto: a.origem === 'atendimento_direto',
    cpf: a.cpfCompareceu,
    telefone: a.telefoneCompareceu,
    email: a.emailCompareceu,
    ehProprietario: a.ehProprietario,
    proprietarioNome: a.proprietarioNome,
    retirante: a.retiranteNome,
    observacoes: a.observacoesAtendimento ?? '',
    agendadoPara: a.dataHora, // relógio escolhido gravado como UTC (ver agenda.js)
    // check-in feito (atendimento direto) também conta como comparecimento
    compareceu: a.presencas.length > 0 || Boolean(a.checkinEm),
    documentos: Object.fromEntries(['termo', 'checklist'].map((t) => [t, a.documentosAssinados.find((d) => d.tipo === t)?.status ?? null])),
    entregueEm:
      a.status === 'realizado'
        ? (a.documentosAssinados.map((d) => d.assinadoEm).filter(Boolean).sort((x, y) => y - x)[0] ?? a.createdAt)
        : null
  });

  const texto = q.trim().toLowerCase();
  const casa = (i) =>
    !texto ||
    [i.unidade, i.agendouNome, i.retirante, i.email].some((v) => String(v ?? '').toLowerCase().includes(texto));
  const dia = (s, fim) => {
    if (!s) return null;
    const d = new Date(`${s}T${fim ? '23:59:59.999' : '00:00:00'}`);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const dDe = dia(de, false);
  const dAte = dia(ate, true);
  const noPeriodo = (data) => (!dDe || data >= dDe) && (!dAte || data <= dAte);

  const receberam = agendamentos
    .filter((a) => a.status === 'realizado')
    .map(item)
    .filter((i) => casa(i) && noPeriodo(i.entregueEm))
    .sort((a, b) => b.entregueEm - a.entregueEm);

  const faltam = agendamentos
    .filter((a) => a.status === 'confirmado' && !unidadesEntregues.has(a.unidade.id))
    .map(item)
    // a data agendada é um relógio gravado como UTC: compara o dia sem fuso
    .filter((i) => {
      const d = new Date(i.agendadoPara.toISOString().slice(0, 10) + 'T12:00:00');
      return casa(i) && noPeriodo(d);
    })
    .sort((a, b) => a.agendadoPara - b.agendadoPara);

  // todas as unidades com entrega concluída, sem os filtros (pro contador geral e pra marcar a presença)
  return { receberam, faltam, unidadesEntregues };
}
