import { db } from '$lib/server/db.js';
import { mediaPesquisa } from '$lib/pesquisa.js';
import { agoraComoRelogioDeBrasilia, dataValida } from '$lib/server/agenda.js';

const PERIODOS = { '7': 7, '30': 30, '90': 90, '365': 365 };

export async function load({ url }) {
  const periodo = PERIODOS[url.searchParams.get('periodo')] ?? 30;
  const empreendimentoId = url.searchParams.get('empreendimentoId') ?? '';

  const fim = new Date();
  const inicio = new Date();
  inicio.setDate(inicio.getDate() - periodo);

  const filtroUnidade = empreendimentoId ? { unidade: { empreendimentoId } } : {};

  const [empreendimentos, agendamentosPeriodo, agendamentosRecentes, emailsPeriodo] = await Promise.all([
    db.empreendimento.findMany({ orderBy: { nome: 'asc' } }),
    db.agendamento.findMany({
      where: { createdAt: { gte: inicio, lte: fim }, ...filtroUnidade },
      include: { tipoEvento: true, unidade: { include: { empreendimento: true } } }
    }),
    db.agendamento.findMany({
      where: filtroUnidade,
      include: { tipoEvento: true, unidade: { include: { empreendimento: true } } },
      orderBy: { createdAt: 'desc' },
      take: 8
    }),
    db.emailEnviado.findMany({ where: { createdAt: { gte: inicio, lte: fim } } })
  ]);

  const pesquisasPeriodo = await db.pesquisaSatisfacao.findMany({
    where: {
      createdAt: { gte: inicio, lte: fim },
      agendamento: filtroUnidade
    }
  });

  // Atendimentos (pela DATA DO ATENDIMENTO, não pela data em que foi agendado): realizados × agendados e não realizados.
  // Filtro: períodos prontos ou um intervalo de datas (de/ate), que vale sobre o relógio de Brasília.
  const agoraRelogio = agoraComoRelogioDeBrasilia();
  const de = url.searchParams.get('de') ?? '';
  const ate = url.searchParams.get('ate') ?? '';
  const intervaloManual = dataValida(de) || dataValida(ate);
  const inicioAt = dataValida(de) ? new Date(`${de}T00:00:00.000Z`) : new Date(agoraRelogio.getTime() - periodo * 86400000);
  const fimAt = dataValida(ate) ? new Date(`${ate}T23:59:59.999Z`) : agoraRelogio;
  const atendimentosPeriodo = await db.agendamento.findMany({
    where: { dataHora: { gte: inicioAt, lte: fimAt }, status: { not: 'cancelado' }, ...filtroUnidade },
    select: { dataHora: true, status: true }
  });
  const atendimentosRealizados = atendimentosPeriodo.filter((a) => a.status === 'realizado').length;
  // agendou, o horário já passou e a entrega não foi concluída
  const agendadosNaoRealizados = atendimentosPeriodo.filter((a) => a.status === 'confirmado' && a.dataHora < agoraRelogio).length;
  const agendadosAFazer = await db.agendamento.count({ where: { status: 'confirmado', dataHora: { gte: agoraRelogio }, ...filtroUnidade } });

  const diasAt = Math.max(1, Math.ceil((fimAt.getTime() - inicioAt.getTime()) / 86400000));
  const numBucketsAt = Math.min(12, diasAt);
  const tamBucketAt = (fimAt.getTime() - inicioAt.getTime()) / numBucketsAt;
  const bucketsAt = Array.from({ length: numBucketsAt }, (_, i) => ({ inicio: new Date(inicioAt.getTime() + i * tamBucketAt), realizados: 0, naoRealizados: 0 }));
  for (const a of atendimentosPeriodo) {
    const i = Math.min(numBucketsAt - 1, Math.max(0, Math.floor((a.dataHora.getTime() - inicioAt.getTime()) / tamBucketAt)));
    if (a.status === 'realizado') bucketsAt[i].realizados++;
    else if (a.status === 'confirmado' && a.dataHora < agoraRelogio) bucketsAt[i].naoRealizados++;
  }
  const maiorAt = Math.max(1, ...bucketsAt.map((b) => b.realizados + b.naoRealizados));

  // KPIs
  const total = agendamentosPeriodo.length;

  const eventosPassados = agendamentosPeriodo.filter((a) => a.dataHora < fim && a.status !== 'confirmado');
  const realizados = agendamentosPeriodo.filter((a) => a.status === 'realizado').length;
  const naoCompareceram = agendamentosPeriodo.filter(
    (a) => a.status === 'confirmado' && a.dataHora < fim
  ).length;
  const baseComparecimento = realizados + naoCompareceram;
  const taxaComparecimento = baseComparecimento > 0 ? Math.round((realizados / baseComparecimento) * 100) : null;

  const totalPesquisas = pesquisasPeriodo.length;
  const satisfacaoMedia =
    totalPesquisas > 0
      ? pesquisasPeriodo.reduce((soma, p) => soma + mediaPesquisa(p), 0) / totalPesquisas
      : null;
  const taxaIndicaria =
    totalPesquisas > 0
      ? Math.round((pesquisasPeriodo.filter((p) => p.indicariaCalper).length / totalPesquisas) * 100)
      : null;

  const totalEmails = emailsPeriodo.length;
  const emailsEnviados = emailsPeriodo.filter((e) => e.enviado).length;
  const taxaEnvioEmail = totalEmails > 0 ? Math.round((emailsEnviados / totalEmails) * 100) : null;

  // abertura/clique só fazem sentido sobre o que foi de fato entregue
  const emailsAbertos = emailsPeriodo.filter((e) => e.enviado && e.abertoEm).length;
  const emailsClicados = emailsPeriodo.filter((e) => e.enviado && e.clicadoEm).length;
  const taxaAbertura = emailsEnviados > 0 ? Math.round((emailsAbertos / emailsEnviados) * 100) : null;
  const taxaClique = emailsEnviados > 0 ? Math.round((emailsClicados / emailsEnviados) * 100) : null;

  // breakdown por tipo de evento
  const porTipo = {};
  for (const a of agendamentosPeriodo) {
    const nome = a.tipoEvento.nome;
    porTipo[nome] = (porTipo[nome] ?? 0) + 1;
  }
  const breakdownTipos = Object.entries(porTipo)
    .map(([nome, qtd]) => ({ nome, qtd }))
    .sort((a, b) => b.qtd - a.qtd);
  const maiorQtdTipo = Math.max(1, ...breakdownTipos.map((t) => t.qtd));

  // gráfico — agendamentos por bucket de tempo (até 10 barras)
  const numBuckets = Math.min(10, periodo);
  const tamanhoBucketMs = (fim.getTime() - inicio.getTime()) / numBuckets;
  const buckets = Array.from({ length: numBuckets }, (_, i) => {
    const inicioBucket = new Date(inicio.getTime() + i * tamanhoBucketMs);
    return { inicio: inicioBucket, qtd: 0 };
  });
  for (const a of agendamentosPeriodo) {
    const idx = Math.min(
      numBuckets - 1,
      Math.floor((a.createdAt.getTime() - inicio.getTime()) / tamanhoBucketMs)
    );
    if (idx >= 0) buckets[idx].qtd++;
  }
  const maiorQtdBucket = Math.max(1, ...buckets.map((b) => b.qtd));

  return {
    periodo: String(periodo),
    de: dataValida(de) ? de : '',
    ate: dataValida(ate) ? ate : '',
    intervaloManual,
    atendimentos: {
      realizados: atendimentosRealizados,
      naoRealizados: agendadosNaoRealizados,
      aFazer: agendadosAFazer,
      grafico: bucketsAt.map((b) => ({
        label: b.inicio.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }),
        realizados: b.realizados,
        naoRealizados: b.naoRealizados,
        pctRealizados: Math.round((b.realizados / maiorAt) * 100),
        pctNaoRealizados: Math.round((b.naoRealizados / maiorAt) * 100)
      }))
    },
    empreendimentoId,
    empreendimentos,
    kpis: {
      total,
      taxaComparecimento,
      totalEmails,
      taxaEnvioEmail,
      taxaAbertura,
      taxaClique,
      satisfacaoMedia: satisfacaoMedia !== null ? Math.round(satisfacaoMedia * 10) / 10 : null,
      totalPesquisas,
      taxaIndicaria
    },
    breakdownTipos: breakdownTipos.map((t) => ({ ...t, pct: Math.round((t.qtd / maiorQtdTipo) * 100) })),
    grafico: buckets.map((b) => ({
      label: b.inicio.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      pct: Math.round((b.qtd / maiorQtdBucket) * 100),
      qtd: b.qtd
    })),
    recentes: agendamentosRecentes.map((a) => ({
      id: a.id,
      unidade: `${a.unidade.numero} — Bloco ${a.unidade.bloco}`,
      empreendimento: a.unidade.empreendimento.nome,
      tipoNome: a.tipoEvento.nome,
      dataHora: a.dataHora,
      status: a.status,
      direto: a.origem === 'atendimento_direto'
    }))
  };
}