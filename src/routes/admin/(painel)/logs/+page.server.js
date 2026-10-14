import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { somenteDigitos } from '$lib/cpf.js';

const POR_PAGINA = 50;

export async function load({ url, locals }) {
  // só perfil "admin" consulta a auditoria
  if (locals.funcionario?.perfil !== 'admin') throw error(403, 'Acesso restrito a administradores.');

  const p = url.searchParams;
  const filtros = {
    ator: ['investidor', 'funcionario'].includes(p.get('ator')) ? p.get('ator') : '',
    acao: p.get('acao') ?? '',
    de: p.get('de') ?? '',
    ate: p.get('ate') ?? '',
    q: (p.get('q') ?? '').trim()
  };
  const pagina = Math.max(1, Number(p.get('pagina')) || 1);

  const where = {};
  if (filtros.ator) where.atorTipo = filtros.ator;
  if (filtros.acao) where.acao = filtros.acao;

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

  if (filtros.q) {
    const digitos = somenteDigitos(filtros.q);
    const [investidores, funcionarios] = await Promise.all([
      db.investidor.findMany({
        where: {
          OR: [
            { nome: { contains: filtros.q, mode: 'insensitive' } },
            ...(digitos ? [{ cpf: { contains: digitos } }] : []),
            { unidades: { some: { email: { contains: filtros.q, mode: 'insensitive' } } } }
          ]
        },
        select: { id: true },
        take: 200
      }),
      db.funcionario.findMany({
        where: {
          OR: [
            { nome: { contains: filtros.q, mode: 'insensitive' } },
            { email: { contains: filtros.q, mode: 'insensitive' } }
          ]
        },
        select: { id: true },
        take: 200
      })
    ]);
    where.OR = [
      { descricao: { contains: filtros.q, mode: 'insensitive' } },
      { investidorId: { in: investidores.map((i) => i.id) } },
      { funcionarioId: { in: funcionarios.map((f) => f.id) } }
    ];
  }

  const [total, logs, acoes] = await Promise.all([
    db.logAcesso.count({ where }),
    db.logAcesso.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA
    }),
    db.logAcesso.findMany({ distinct: ['acao'], select: { acao: true }, orderBy: { acao: 'asc' } })
  ]);

  const idsInv = [...new Set(logs.map((l) => l.investidorId).filter(Boolean))];
  const idsFun = [...new Set(logs.map((l) => l.funcionarioId).filter(Boolean))];
  const [invs, funs] = await Promise.all([
    db.investidor.findMany({ where: { id: { in: idsInv } }, select: { id: true, nome: true } }),
    db.funcionario.findMany({ where: { id: { in: idsFun } }, select: { id: true, nome: true } })
  ]);
  const nomeInv = new Map(invs.map((i) => [i.id, i.nome]));
  const nomeFun = new Map(funs.map((f) => [f.id, f.nome]));

  return {
    filtros,
    pagina,
    totalPaginas: Math.max(1, Math.ceil(total / POR_PAGINA)),
    total,
    acoes: acoes.map((a) => a.acao),
    logs: logs.map((l) => ({
      id: l.id,
      createdAt: l.createdAt,
      atorTipo: l.atorTipo,
      ator: l.atorTipo === 'investidor' ? nomeInv.get(l.investidorId) : nomeFun.get(l.funcionarioId),
      acao: l.acao,
      descricao: l.descricao,
      ip: l.ip
    }))
  };
}
