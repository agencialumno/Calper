// Limites de upload checados no navegador, antes do envio.
// A Vercel recusa (413) qualquer requisição com corpo acima de 4,5 MB antes de o código rodar,
// então a validação do servidor (arquivoParaBase64) nunca é alcançada nesses casos.

export const LIMITE_ARQUIVO_BYTES = 4 * 1024 * 1024; // mesmo limite que o servidor aplica por arquivo
export const LIMITE_TOTAL_BYTES = 4.2 * 1024 * 1024; // soma de todos os arquivos de um envio (margem p/ o resto do formulário)

export function formatarTamanho(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

export function mensagemArquivoGrande(arquivo) {
  return `O arquivo "${arquivo.name}" tem ${formatarTamanho(arquivo.size)} e o limite é ${formatarTamanho(LIMITE_ARQUIVO_BYTES)}. Escolha um arquivo menor ou reduza a qualidade/resolução da foto.`;
}

export function mensagemTotalGrande(total) {
  return `Os arquivos anexados somam ${formatarTamanho(total)} e o limite por envio é ${formatarTamanho(LIMITE_TOTAL_BYTES)}. Remova ou reduza algum arquivo para continuar.`;
}
