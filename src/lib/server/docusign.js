import docusign from 'docusign-esign';
import { env } from '$env/dynamic/private';

// Integração DocuSign (JWT Grant + embedded signing).
// Env: DOCUSIGN_INTEGRATION_KEY, DOCUSIGN_USER_ID, DOCUSIGN_ACCOUNT_ID,
// DOCUSIGN_BASE_URI (ex: https://demo.docusign.net), DOCUSIGN_RSA_PRIVATE_KEY.

const MARGEM_EXPIRACAO_MS = 5 * 60 * 1000;
let tokenEmCache = null; // { token, expiraEm }

function configurado() {
  return Boolean(
    env.DOCUSIGN_INTEGRATION_KEY &&
      env.DOCUSIGN_USER_ID &&
      env.DOCUSIGN_ACCOUNT_ID &&
      env.DOCUSIGN_BASE_URI &&
      env.DOCUSIGN_RSA_PRIVATE_KEY
  );
}

function hostOAuth() {
  return env.DOCUSIGN_BASE_URI.includes('demo') ? 'account-d.docusign.com' : 'account.docusign.com';
}

/** Access token via JWT Grant, com cache em memória (~1h de validade). */
export async function obterAccessToken() {
  if (!configurado()) throw new Error('DocuSign não configurado (variáveis DOCUSIGN_* ausentes).');

  if (tokenEmCache && tokenEmCache.expiraEm - MARGEM_EXPIRACAO_MS > Date.now()) {
    return tokenEmCache.token;
  }

  const apiClient = new docusign.ApiClient();
  apiClient.setOAuthBasePath(hostOAuth());

  const chavePrivada = Buffer.from(env.DOCUSIGN_RSA_PRIVATE_KEY.replace(/\\n/g, '\n'));
  const resposta = await apiClient.requestJWTUserToken(
    env.DOCUSIGN_INTEGRATION_KEY,
    env.DOCUSIGN_USER_ID,
    ['signature', 'impersonation'],
    chavePrivada,
    3600
  );

  const { access_token: token, expires_in: expiraEmSegundos } = resposta.body;
  tokenEmCache = { token, expiraEm: Date.now() + expiraEmSegundos * 1000 };
  return token;
}

async function clienteAutenticado() {
  const token = await obterAccessToken();
  const apiClient = new docusign.ApiClient();
  apiClient.setBasePath(`${env.DOCUSIGN_BASE_URI.replace(/\/$/, '')}/restapi`);
  apiClient.addDefaultHeader('Authorization', `Bearer ${token}`);
  return apiClient;
}

/**
 * Cria um envelope com 1 signatário embutido (clientUserId preenchido = sem e-mail do DocuSign)
 * e devolve a URL de assinatura.
 * A assinatura é posicionada pela âncora de texto `ancora` presente no PDF.
 */
export async function criarEnvelopeEmbedded({
  pdfBase64,
  nomeDocumento,
  signatario,
  retornoUrl,
  ancora = '[ASSINATURA DO INVESTIDOR'
}) {
  const apiClient = await clienteAutenticado();
  const envelopesApi = new docusign.EnvelopesApi(apiClient);
  const accountId = env.DOCUSIGN_ACCOUNT_ID;

  const documento = docusign.Document.constructFromObject({
    documentBase64: pdfBase64,
    name: nomeDocumento,
    fileExtension: 'pdf',
    documentId: '1'
  });

  const signHere = docusign.SignHere.constructFromObject({
    anchorString: ancora,
    anchorUnits: 'pixels',
    anchorXOffset: '0',
    anchorYOffset: '-28',
    anchorIgnoreIfNotPresent: 'false'
  });

  const signer = docusign.Signer.constructFromObject({
    email: signatario.email,
    name: signatario.nome,
    recipientId: '1',
    clientUserId: signatario.clientUserId,
    tabs: docusign.Tabs.constructFromObject({ signHereTabs: [signHere] })
  });

  const envelope = docusign.EnvelopeDefinition.constructFromObject({
    emailSubject: `Assinatura — ${nomeDocumento}`,
    documents: [documento],
    recipients: docusign.Recipients.constructFromObject({ signers: [signer] }),
    status: 'sent'
  });

  const criado = await envelopesApi.createEnvelope(accountId, { envelopeDefinition: envelope });

  const view = docusign.RecipientViewRequest.constructFromObject({
    returnUrl: retornoUrl,
    authenticationMethod: 'none',
    email: signatario.email,
    userName: signatario.nome,
    clientUserId: signatario.clientUserId
  });
  const vista = await envelopesApi.createRecipientView(accountId, criado.envelopeId, {
    recipientViewRequest: view
  });

  return { envelopeId: criado.envelopeId, urlAssinatura: vista.url };
}

/** Status do envelope no DocuSign (ex: "sent", "completed"). */
export async function statusDoEnvelope(envelopeId) {
  const apiClient = await clienteAutenticado();
  const envelopesApi = new docusign.EnvelopesApi(apiClient);
  const envelope = await envelopesApi.getEnvelope(env.DOCUSIGN_ACCOUNT_ID, envelopeId);
  return envelope.status;
}

/** Baixa o PDF final (todos os documentos combinados) como data URL base64. */
export async function baixarPdfAssinado(envelopeId) {
  const apiClient = await clienteAutenticado();
  const envelopesApi = new docusign.EnvelopesApi(apiClient);
  const binario = await envelopesApi.getDocument(env.DOCUSIGN_ACCOUNT_ID, envelopeId, 'combined');
  const buffer = Buffer.isBuffer(binario) ? binario : Buffer.from(binario, 'binary');
  return `data:application/pdf;base64,${buffer.toString('base64')}`;
}
