import { db } from '$lib/server/db.js';
import { statusDaUnidade } from '$lib/server/unidadeStatus.js';
import { podeEditar } from '$lib/perfis.js';
import { buscarMurano } from '$lib/server/entregaChaves.js';
import { agendamentosAtivosPorUnidade, atendimentoDaUnidade } from '$lib/server/atendimentoDireto.js';

// A listagem é agrupada (bloco → andar) e filtrada no navegador, então carrega
// todas as unidades de uma vez (centenas de linhas leves, sem anexos).
export async function load({ url, locals }) {
  const unidades = await db.unidade.findMany({
    include: { empreendimento: true, investidores: { include: { investidor: true } } },
    orderBy: [{ bloco: 'asc' }, { numero: 'asc' }]
  });

  // botão "Iniciar atendimento": abrir o agendamento existente, iniciar ou bloqueada (com o motivo)
  const [murano, ativos] = await Promise.all([buscarMurano(), agendamentosAtivosPorUnidade()]);

  return {
    q: url.searchParams.get('q')?.trim() ?? '',
    podeEditar: podeEditar(locals.funcionario.perfil),
    total: unidades.length,
    unidades: unidades.map((u) => {
      const compradores = Array.isArray(u.compradores) ? u.compradores : [];
      return {
        id: u.id,
        numero: u.numero,
        bloco: u.bloco,
        empreendimento: u.empreendimento.nome,
        status: u.status,
        ...statusDaUnidade(u), // tipologia, grupo, Status-Quitação, vistoria, escritura atual e o "ver mais"
        compradores: compradores.map((c) => ({ nome: c.nome, principal: Boolean(c.principal) })),
        investidores: u.investidores.map((vi) => vi.investidor.nome),
        atendimento: atendimentoDaUnidade(u, ativos.get(u.id), murano?.id)
      };
    })
  };
}
