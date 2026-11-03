// Serviços que o cliente pode agendar. O serviço de um agendamento é o seu TipoEvento (slug): não há coluna "serviço".
// Entrega de chaves continua sendo o padrão, para não mudar o comportamento de quem não escolhe nada.
export const SERVICOS = {
  'entrega-chaves': { slug: 'entrega-chaves', valor: 'entrega-chaves', rotulo: 'Entrega de chaves', minusculo: 'entrega de chaves', artigo: 'a' },
  vistoria: { slug: 'vistoria', valor: 'vistoria', rotulo: 'Vistoria', minusculo: 'vistoria', artigo: 'a' }
};

export const SERVICO_PADRAO = 'entrega-chaves';
export const SLUG_VISTORIA = 'vistoria';
/** Ordem do dropdown "Serviço" (Vistoria primeiro na leitura do cliente; o padrão selecionado continua a entrega). */
export const LISTA_SERVICOS = [SERVICOS.vistoria, SERVICOS['entrega-chaves']];

/** Valor vindo de formulário/URL → serviço válido (qualquer outra coisa cai no padrão). */
export function servicoValido(valor) {
  return Object.hasOwn(SERVICOS, String(valor ?? '')) ? String(valor) : SERVICO_PADRAO;
}

export const slugDoServico = (servico) => SERVICOS[servicoValido(servico)].slug;
export const rotuloDoServico = (servico) => SERVICOS[servicoValido(servico)].rotulo;
/** O slug do TipoEvento é o próprio valor do serviço. */
export const servicoDoSlug = (slug) => servicoValido(slug);

/**
 * Blocos em que cada serviço pode ser agendado — o único lugar que define isso. Vistoria é só do Bloco 3.
 * `null` = sem restrição de bloco (como a entrega de chaves sempre foi). Para restringir a entrega ao Bloco 2 basta
 * trocar para ['2'] (hoje os testes e2e da entrega usam unidades de outros blocos, por isso fica sem restrição).
 * Os números de unidade se repetem entre blocos: tudo que usa o mapa compara bloco + número, nunca só o número.
 */
export const BLOCOS_POR_SERVICO = {
  'entrega-chaves': null,
  vistoria: ['3']
};

/** A unidade (com `bloco`) pode receber esse serviço? */
export function blocoPermitido(servico, bloco) {
  const blocos = BLOCOS_POR_SERVICO[servicoValido(servico)];
  return !blocos || blocos.includes(String(bloco ?? '').trim());
}
