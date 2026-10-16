// Agrupamento da listagem de unidades: empreendimento/bloco → andar.
// Padrão confirmado nas 160 unidades do Murano: os 2 últimos dígitos são a
// unidade no andar e o restante é o andar (101 → 1º, 1610 → 16º).

/** Andar derivado do número da unidade, ou null se o número não seguir o padrão. */
export function andarDaUnidade(numero) {
  const n = String(numero).trim();
  if (!/^\d{3,}$/.test(n)) return null;
  return Number(n.slice(0, -2));
}

const collator = new Intl.Collator('pt-BR', { numeric: true });

/** Agrupa em [{ chave, bloco, empreendimento, andares: [{ chave, andar, unidades }] }]. */
export function agruparUnidades(unidades) {
  const blocos = new Map();

  for (const u of unidades) {
    const chaveBloco = `${u.empreendimento}\u0000${u.bloco}`;
    if (!blocos.has(chaveBloco)) {
      blocos.set(chaveBloco, { chave: chaveBloco, bloco: u.bloco, empreendimento: u.empreendimento, porAndar: new Map() });
    }
    const andar = andarDaUnidade(u.numero);
    const porAndar = blocos.get(chaveBloco).porAndar;
    if (!porAndar.has(andar)) porAndar.set(andar, []);
    porAndar.get(andar).push(u);
  }

  return [...blocos.values()]
    .sort((a, b) => collator.compare(a.empreendimento, b.empreendimento) || collator.compare(a.bloco, b.bloco))
    .map((b) => ({
      chave: b.chave,
      bloco: b.bloco,
      empreendimento: b.empreendimento,
      total: [...b.porAndar.values()].reduce((s, l) => s + l.length, 0),
      andares: [...b.porAndar.entries()]
        // andar nulo (número fora do padrão) vai pro fim
        .sort(([x], [y]) => (x === null) - (y === null) || x - y)
        .map(([andar, lista]) => ({
          chave: `${b.chave}\u0000${andar}`,
          andar,
          unidades: lista.sort((x, y) => collator.compare(x.numero, y.numero))
        }))
    }));
}
