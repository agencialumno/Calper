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
 * `null` = sem restrição de bloco. Entrega de chaves: sem restrição, exceto os blocos de BLOCOS_BLOQUEADOS_POR_SERVICO
 * (o Bloco 3 ainda não tem entrega de chaves; os testes e2e da entrega usam os blocos 8 e 9, por isso não é "só Bloco 2").
 * Os números de unidade se repetem entre blocos: tudo que usa o mapa compara bloco + número, nunca só o número.
 */
export const BLOCOS_POR_SERVICO = {
  'entrega-chaves': null,
  vistoria: ['3']
};

export const BLOCOS_BLOQUEADOS_POR_SERVICO = {
  'entrega-chaves': ['3'],
  vistoria: []
};

export const MENSAGEM_BLOCO3_ENTREGA = 'Ainda não é possível agendar a entrega de chaves para o Bloco 3.';
export const AVISO_BLOCO_VISTORIA = 'A vistoria está disponível apenas para o Bloco 3.';

/** A unidade (com `bloco`) pode receber esse serviço? */
export function blocoPermitido(servico, bloco) {
  const sv = servicoValido(servico);
  const b = String(bloco ?? '').trim();
  const blocos = BLOCOS_POR_SERVICO[sv];
  return (!blocos || blocos.includes(b)) && !BLOCOS_BLOQUEADOS_POR_SERVICO[sv].includes(b);
}
