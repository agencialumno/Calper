import { db } from '$lib/server/db.js';
import { SLUG_ENTREGA_CHAVES } from '$lib/server/entregaChaves.js';

// Todas as pessoas que agendaram a entrega de chaves pelo formulário público (/agendar-entrega-chaves),
// inclusive agendamentos cancelados, pra a equipe ter a lista completa de quem agendou.
export async function load({ url }) {
  const q = (url.searchParams.get('q') ?? '').trim();
  const status = url.searchParams.get('status') ?? '';

  const where = {
    tipoEvento: { slug: SLUG_ENTREGA_CHAVES },
    ...(['confirmado', 'realizado', 'cancelado'].includes(status) ? { status } : {}),
    ...(q
      ? {
          OR: [
            { nomeCompareceu: { contains: q, mode: 'insensitive' } },
            { proprietarioNome: { contains: q, mode: 'insensitive' } },
            { emailCompareceu: { contains: q, mode: 'insensitive' } },
            { telefoneCompareceu: { contains: q } },
            { cpfCompareceu: { contains: q.replace(/\D/g, '') || '__sem_digitos__' } },
            { unidade: { numero: { contains: q, mode: 'insensitive' } } }
          ]
        }
      : {})
  };

  const [agendamentos, total] = await Promise.all([
    db.agendamento.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        dataHora: true,
        status: true,
        nomeCompareceu: true,
        cpfCompareceu: true,
        telefoneCompareceu: true,
        emailCompareceu: true,
        ehProprietario: true,
        proprietarioNome: true,
        procuracaoCpf: true, // só pra saber se há procuração, sem trazer o arquivo
        unidade: { select: { id: true, bloco: true, numero: true } }
      }
    }),
    db.agendamento.count({ where: { tipoEvento: { slug: SLUG_ENTREGA_CHAVES } } })
  ]);

  return {
    filtros: { q, status },
    total,
    agendamentos: agendamentos.map((a) => ({
      id: a.id,
      agendadoEm: a.createdAt,
      dataHora: a.dataHora,
      status: a.status,
      nome: a.nomeCompareceu,
      cpf: a.cpfCompareceu,
      telefone: a.telefoneCompareceu,
      email: a.emailCompareceu,
      ehProprietario: a.ehProprietario,
      proprietarioNome: a.proprietarioNome,
      temProcuracao: Boolean(a.procuracaoCpf),
      unidadeId: a.unidade.id,
      unidade: `Bloco ${a.unidade.bloco} - nº ${a.unidade.numero}`
    }))
  };
}
