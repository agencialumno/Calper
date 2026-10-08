import { db } from '$lib/server/db.js';
import { mediaPesquisa } from '$lib/pesquisa.js';

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
      status: a.status
    }))
  };
}