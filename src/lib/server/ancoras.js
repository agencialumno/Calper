// Âncoras (texto branco de 1pt desenhado sobre a linha de assinatura) onde o DocuSign posiciona cada caixa de
// assinatura. Termo e checklist vão no mesmo envelope, então cada documento tem âncoras próprias: se fossem
// iguais, a caixa de um destinatário apareceria nos dois documentos. Nenhuma pode ser prefixo de outra.
export const ANCORA = {
  termo: { calper: '[TERMO M1', cliente: '[TERMO CLIENTE', conjuge: '[TERMO CONJUGE' },
  checklist: { calper: '[CHECKLIST M1', cliente: '[CHECKLIST CLIENTE', conjuge: '[CHECKLIST CONJUGE' }
};

/**
 * Âncora de um bloco de assinatura do texto do documento. `grupo1` é o que vem depois de "[ASSINATURA" na linha:
 * vazio = linha da M1/Calper; " DO INVESTIDOR" = cliente; " DO CÔNJUGE" = cônjuge.
 */
export function ancoraDoBloco(documento, grupo1) {
  const g = String(grupo1 ?? '').toUpperCase();
  if (g.includes('CÔNJUGE') || g.includes('CONJUGE')) return ANCORA[documento].conjuge;
  if (g.includes('INVESTIDOR')) return ANCORA[documento].cliente;
  return ANCORA[documento].calper;
}

// Termo de Recebimento do Imóvel (vistoria): um envelope só com o termo; a Calper (funcionário do atendimento) assina
// primeiro e cada proprietário/procurador tem a própria âncora (numerada). O "]" no fim impede que uma âncora seja prefixo de outra.
export const ANCORA_VISTORIA = {
  calper: '[VISTORIA M1]',
  assinante: (n) => `[VISTORIA ASSINANTE ${n}]`
};

// Ficha de reparos (parte superior do FORM-020, vistoria não aceita): âncoras próprias, diferentes das do Termo de
// Recebimento (parte inferior). Assim, na revistoria, o novo envelope usa o PDF já assinado como base e só as âncoras
// do termo recebem caixas: as da ficha (já assinada) não são tocadas.
export const ANCORA_FICHA = {
  calper: '[FICHA M1]',
  assinante: (n) => `[FICHA ASSINANTE ${n}]`
};

// Campos que quem acompanha pela Calper preenche na hora de assinar (obrigatórios): nome, sobrenome e rubrica.
// Âncora invisível sobre cada linha, uma série por parte do documento.
export const CAMPOS_CALPER = {
  termo: { nome: '[VISTORIA M1 NOME]', sobrenome: '[VISTORIA M1 SOBRENOME]', rubrica: '[VISTORIA M1 RUBRICA]' },
  ficha: { nome: '[FICHA M1 NOME]', sobrenome: '[FICHA M1 SOBRENOME]', rubrica: '[FICHA M1 RUBRICA]' }
};
