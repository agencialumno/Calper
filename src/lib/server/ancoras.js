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
