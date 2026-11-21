import { readFileSync } from 'node:fs';

// Permite `import dados from './arquivo.pdf?base64'`: o PDF vira uma string base64 dentro do código do servidor,
// então vai junto no deploy da Vercel (não depende de ler arquivo em tempo de execução).
export function pdfBase64() {
  return {
    name: 'pdf-base64',
    enforce: 'pre',
    load(id) {
      if (!/\.pdf\?base64$/.test(id)) return null;
      const arquivo = id.replace(/\?base64$/, '');
      return `export default ${JSON.stringify(readFileSync(arquivo).toString('base64'))};`;
    }
  };
}
