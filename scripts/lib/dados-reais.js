// Trava dos scripts de limpeza: depois que o sistema entrou em uso, existem agendamentos reais em produção e esses
// scripts NÃO podem apagar nada sem uma confirmação explícita (--confirmo-dados-reais). Código puro (sem banco): testado.

export const FLAG_DADOS_REAIS = '--confirmo-dados-reais';

/**
 * @param {{ status: string, origem?: string|null, dataHora: Date, createdAt: Date }[]} agendamentos
 * @returns {{ total: number, porStatus: Record<string,number>, porOrigem: Record<string,number>, primeiro: Date|null, ultimo: Date|null, temDadosReais: boolean }}
 */
export function resumirAgendamentos(agendamentos) {
  const porStatus = {};
  const porOrigem = {};
  let primeiro = null;
  let ultimo = null;
  for (const a of agendamentos) {
    porStatus[a.status] = (porStatus[a.status] ?? 0) + 1;
    const o = a.origem ?? 'agendamento';
    porOrigem[o] = (porOrigem[o] ?? 0) + 1;
    if (!primeiro || a.dataHora < primeiro) primeiro = a.dataHora;
    if (!ultimo || a.dataHora > ultimo) ultimo = a.dataHora;
  }
  // qualquer agendamento (de qualquer origem, status ou data) conta como dado real: a regra é conservadora de propósito
  return { total: agendamentos.length, porStatus, porOrigem, primeiro, ultimo, temDadosReais: agendamentos.length > 0 };
}

/** Linhas de texto para a simulação (e para a recusa). */
export function descreverResumo(r) {
  if (r.total === 0) return ['Agendamentos existentes: 0.'];
  const fmt = (d) => d.toISOString().slice(0, 10).split('-').reverse().join('/');
  return [
    `Agendamentos existentes que seriam afetados: ${r.total} (${Object.entries(r.porStatus).map(([k, v]) => `${k}: ${v}`).join(', ')})`,
    `  por origem: ${Object.entries(r.porOrigem).map(([k, v]) => `${k}: ${v}`).join(', ')} | datas: ${fmt(r.primeiro)} a ${fmt(r.ultimo)}`
  ];
}

/** Decide se o --aplicar pode seguir: sem dados reais, ou com a flag explícita. Devolve null se pode, ou a mensagem de recusa. */
export function recusaDadosReais(resumo, argv) {
  if (!resumo.temDadosReais || argv.includes(FLAG_DADOS_REAIS)) return null;
  return `RECUSADO: existem ${resumo.total} agendamento(s) (uso real). Este script não roda com --aplicar sem a confirmação explícita ${FLAG_DADOS_REAIS}. Nada foi alterado.`;
}
