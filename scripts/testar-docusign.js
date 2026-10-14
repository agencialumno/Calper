// Testa só a autenticação DocuSign (JWT Grant): gera o access token e imprime se deu certo.
// Rodar com: node scripts/testar-docusign.js
import fs from 'node:fs';
import docusign from 'docusign-esign';

// carrega o .env (aceita valor multilinha entre aspas, como a chave RSA)
if (fs.existsSync('.env')) {
  const texto = fs.readFileSync('.env', 'utf8');
  for (const m of texto.matchAll(/^([A-Z_][A-Z0-9_]*)=("[^"]*"|[^\r\n]*)/gm)) {
    process.env[m[1]] ??= m[2].replace(/^"|"$/g, '');
  }
}

const obrigatorias = [
  'DOCUSIGN_INTEGRATION_KEY',
  'DOCUSIGN_USER_ID',
  'DOCUSIGN_ACCOUNT_ID',
  'DOCUSIGN_BASE_URI',
  'DOCUSIGN_RSA_PRIVATE_KEY'
];
const faltando = obrigatorias.filter((k) => !process.env[k]);
if (faltando.length) {
  console.error(`FALHOU: variáveis ausentes no .env: ${faltando.join(', ')}`);
  process.exit(1);
}

const env = process.env;
const hostOAuth = env.DOCUSIGN_BASE_URI.includes('demo') ? 'account-d.docusign.com' : 'account.docusign.com';

try {
  const apiClient = new docusign.ApiClient();
  apiClient.setOAuthBasePath(hostOAuth);

  const chavePrivada = Buffer.from(env.DOCUSIGN_RSA_PRIVATE_KEY.replace(/\\n/g, '\n'));
  const { body } = await apiClient.requestJWTUserToken(
    env.DOCUSIGN_INTEGRATION_KEY,
    env.DOCUSIGN_USER_ID,
    ['signature', 'impersonation'],
    chavePrivada,
    3600
  );

  console.log('OK: access token gerado.');
  console.log(`  ambiente: ${hostOAuth}`);
  console.log(`  token: ${body.access_token.slice(0, 12)}… (${body.access_token.length} caracteres)`);
  console.log(`  expira em: ${body.expires_in}s`);
} catch (err) {
  const detalhe = err?.response?.body ?? err?.message ?? err;
  console.error('FALHOU ao gerar o token:', typeof detalhe === 'string' ? detalhe : JSON.stringify(detalhe));
  if (JSON.stringify(detalhe).includes('consent_required')) {
    console.error('Consentimento do admin (impersonation) ainda não concedido.');
  }
  process.exit(1);
}
