import { db } from '$lib/server/db.js';
import { PERGUNTAS_ESCALA, pontosEscala } from '$lib/pesquisa.js';

const POR_PAGINA = 30;

export async function load({ url }) {
  const p = url.searchParams;
  const filtros = {
    empreendimento: p.get('empreendimento') ?? '',
    de: p.get('de') ?? '',
    ate: p.get('ate') ?? '',
    soNaoIndicaria: p.get('naoIndicaria') === '1'
  };
  const pagina = Math.max(1, Number(p.get('pagina')) || 1);

  const where = {};
  if (filtros.empreendimento) where.agendamento = { unidade: { empreendimentoId: filtros.empreendimento } };
  if (filtros.soNaoIndicaria) where.indicariaCalper = false;

  const createdAt = {};
  if (filtros.de) {
    const d = new Date(`${filtros.de}T00:00:00`);
    if (!Number.isNaN(d.getTime())) createdAt.gte = d;
  }
  if (filtros.ate) {
    const d = new Date(`${filtros.ate}T23:59:59.999`);
    if (!Number.isNaN(d.getTime())) createdAt.lte = d;
  }
  if (createdAt.gte || createdAt.lte) where.createdAt = createdAt;

  const camposEscala = Object.fromEntries(PERGUNTAS_ESCALA.map((q) => [q.campo, true]));

  const [empreendimentos, total, respostas, paraResumo] = await Promise.all([
    db.empreendimento.findMany({ orderBy: { nome: 'asc' }, select: { id: true, nome: true } }),
    db.pesquisaSatisfacao.count({ where }),
    db.pesquisaSatisfacao.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
      include: {
        agendamento: {
          include: { tipoEvento: true, unidade: { include: { empreendimento: true } } }
        }
      }
    }),
    // resumo considera o conjunto filtrado inteiro, não só a página atual
    db.pesquisaSatisfacao.findMany({
      where,
      select: { ...camposEscala, indicariaCalper: true, atendidoNoHorario: true }
    })
  ]);

  const n = paraResumo.length;
  const resumo = {
    total: n,
    indicaria: n ? Math.round((paraResumo.filter((r) => r.indicariaCalper).length / n) * 100) : null,
    noHorario: n ? Math.round((paraResumo.filter((r) => r.atendidoNoHorario).length / n) * 100) : null,
    medias: PERGUNTAS_ESCALA.map((q) => ({
      campo: q.campo,
      rotulo: q.rotulo,
      media: n
        ? Math.round((paraResumo.reduce((soma, r) => soma + pontosEscala(r[q.campo]), 0) / n) * 10) / 10
        : null
    }))
  };

  return {
    filtros,
    pagina,
    total,
    totalPaginas: Math.max(1, Math.ceil(total / POR_PAGINA)),
    empreendimentos,
    resumo,
    respostas: respostas.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      bloco: r.agendamento.unidade.bloco,
      numero: r.agendamento.unidade.numero,
      empreendimento: r.agendamento.unidade.empreendimento.nome,
      tipoNome: r.agendamento.tipoEvento.nome,
      indicariaCalper: r.indicariaCalper,
      notas: PERGUNTAS_ESCALA.map((q) => ({ campo: q.campo, rotulo: q.rotulo, pontos: pontosEscala(r[q.campo]) }))
    }))
  };
}
