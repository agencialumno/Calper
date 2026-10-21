// Posição horizontal da caixa de assinatura do DocuSign (ver docusign.js).
export const LARGURA_LINHA = 440; // largura da linha de assinatura nos PDFs, em pontos

// O DocuSign ancora a caixa pelo canto esquerdo, e a largura da caixa assinada depende do nome (o carimbo
// mostra o nome do signatário): nomes longos e em maiúsculas ficam bem mais largos. Estimamos a largura pelo nome
// (calibrado com assinaturas reais: ~11,3 pt por letra em MAIÚSCULAS e ~8,6 pt em minúsculas, na escala 1,5)
// e deslocamos a âncora pra a caixa ficar centralizada sobre a linha.
export function xOffsetCentralizado(nome) {
  const texto = String(nome ?? '').trim();
  const porLetra = texto === texto.toUpperCase() ? 11.3 : 8.6;
  const largura = Math.min(LARGURA_LINHA - 10, texto.length * porLetra);
  return String(Math.max(5, Math.round((LARGURA_LINHA - largura) / 2)));
}

