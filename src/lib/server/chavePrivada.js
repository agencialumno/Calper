import { createPrivateKey } from 'node:crypto';

/**
 * Aceita a chave privada RSA do DocuSign em qualquer forma comum de colar numa variável de ambiente
 * e devolve um PEM válido: com aspas ao redor, com "\n" literal (ou "\n"), com CRLF, tudo numa linha
 * só, com as quebras viradas em espaços, ou o PEM inteiro em base64.
 * Lança um erro claro (sem expor a chave) quando nem assim dá pra montar uma chave válida.
 */
export function normalizarChavePrivada(bruto, nomeVariavel = 'DOCUSIGN_RSA_PRIVATE_KEY') {
  let valor = String(bruto ?? '').trim();
  if (!valor) throw new Error(`${nomeVariavel} está vazia.`);

  // aspas ao redor (comum ao copiar de um .env)
  valor = valor.replace(/^(["'])([\s\S]*)\1$/, '$2').trim();

  // PEM inteiro em base64 (sem cabeçalho "-----BEGIN")
  if (!valor.includes('-----BEGIN')) {
    try {
      const decodificado = Buffer.from(valor, 'base64').toString('utf8');
      if (decodificado.includes('-----BEGIN')) valor = decodificado;
    } catch {
      // segue com o valor original; a validação abaixo acusa o problema
    }
  }

  // "\n" literal, "\n" e CRLF viram quebra de linha real
  valor = valor.replace(/\+r?\*n/g, '\n').replace(/\r\n?/g, '\n');

  // reconstrói o PEM a partir do cabeçalho/rodapé: o corpo pode estar em uma linha ou com espaços no lugar das quebras
  const pem = valor.match(/-----BEGIN ([A-Z ]+)-----([\s\S]*?)-----END \1-----/);
  if (pem) {
    const corpo = pem[2].replace(/[^A-Za-z0-9+/=]/g, '');
    const linhas = corpo.match(/.{1,64}/g) ?? [];
    valor = `-----BEGIN ${pem[1]}-----\n${linhas.join('\n')}\n-----END ${pem[1]}-----\n`;
  }

  try {
    createPrivateKey(valor);
  } catch {
    throw new Error(
      `${nomeVariavel} não é uma chave privada RSA válida. Cole o PEM completo, do "-----BEGIN RSA PRIVATE KEY-----" ` +
        'até o "-----END RSA PRIVATE KEY-----" (da chave gerada no DocuSign), sem alterar o conteúdo.'
    );
  }
  return valor;
}
