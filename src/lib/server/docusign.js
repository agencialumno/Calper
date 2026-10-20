import docusign from 'docusign-esign';
import { env } from '$env/dynamic/private';
import { normalizarChavePrivada } from './chavePrivada.js';

// Integração DocuSign (JWT Grant + assinatura embutida da Calper + assinatura remota do cliente).
// Env: DOCUSIGN_INTEGRATION_KEY, DOCUSIGN_USER_ID, DOCUSIGN_ACCOUNT_ID,
// DOCUSIGN_BASE_URI (ex: https://na4.docusign.net), DOCUSIGN_RSA_PRIVATE_KEY.
// Opcionais: DOCUSIGN_ASSINANTE_NOME / DOCUSIGN_ASSINANTE_EMAIL (quem assina pela Calper) e
// DOCUSIGN_EMAIL_COPIA (quem recebe a cópia do documento final). Sem elas, valem o nome e o e-mail
// do usuário DocuSign da integração.

const MARGEM_EXPIRACAO_MS = 5 * 60 * 1000;
let tokenEmCache = null; // { token, expiraEm }
let usuarioEmCache = null; // { nome, email }

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

  const chavePrivada = Buffer.from(normalizarChavePrivada(env.DOCUSIGN_RSA_PRIVATE_KEY));
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

/** Host das páginas de assinatura do DocuSign (origem das mensagens postadas ao iframe). */
function origemApps() {
  return env.DOCUSIGN_BASE_URI.includes('demo') ? 'https://apps-d.docusign.com' : 'https://apps.docusign.com';
}

/** Nome e e-mail do usuário DocuSign da integração (donos da conta), com cache. */
async function usuarioDaIntegracao() {
  if (usuarioEmCache) return usuarioEmCache;
  const token = await obterAccessToken();
  const apiClient = new docusign.ApiClient();
  apiClient.setOAuthBasePath(hostOAuth());
  const info = await apiClient.getUserInfo(token);
  usuarioEmCache = { nome: info.name, email: info.email };
  return usuarioEmCache;
}

/**
 * Quem assina pela Calper (cerimônia embutida, primeiro da ordem): o e-mail é o do usuário dono da conta
 * DocuSign, mas o nome que aparece como signatário é sempre "Calper Construtora" (DOCUSIGN_ASSINANTE_NOME muda).
 */
export async function assinanteDaCalper() {
  const nome = env.DOCUSIGN_ASSINANTE_NOME || 'Calper Construtora';
  if (env.DOCUSIGN_ASSINANTE_EMAIL) return { nome, email: env.DOCUSIGN_ASSINANTE_EMAIL };
  return { nome, email: (await usuarioDaIntegracao()).email };
}

/** Quem recebe a cópia do documento final assinado (destinatário "cópia carbono"). */
export async function destinatarioDaCopia() {
  if (env.DOCUSIGN_EMAIL_COPIA) return { nome: 'Calper', email: env.DOCUSIGN_EMAIL_COPIA };
  const u = await usuarioDaIntegracao();
  return { nome: u.nome, email: u.email };
}

// Âncoras (texto invisível no PDF) onde cada assinatura é posicionada. Não podem ser prefixo umas das outras.
export const ANCORA_CALPER = '[ASSINATURA M1';
export const ANCORA_INVESTIDOR = '[ASSINATURA DO INVESTIDOR';
export const ANCORA_CONJUGE = '[ASSINATURA DO CÔNJUGE';

const ehEmailDeExemplo = (email) => /@example\.(com|org|net)$/i.test(String(email ?? ''));

function tabAssinar(ancora) {
  return docusign.Tabs.constructFromObject({
    signHereTabs: [
      docusign.SignHere.constructFromObject({
        anchorString: ancora,
        anchorUnits: 'pixels',
        anchorXOffset: '0',
        anchorYOffset: '-28',
        anchorIgnoreIfNotPresent: 'false'
      })
    ]
  });
}

/**
 * Cria o envelope com a ordem de assinatura da entrega de chaves:
 *  1. Calper — assinatura EMBUTIDA no admin (clientUserId preenchido), primeiro da ordem;
 *  2. cliente e, se houver, cônjuge — assinatura REMOTA: o DocuSign manda um e-mail com o link a cada
 *     um, separadamente, só depois que a Calper assinou (routingOrder 2, os dois em paralelo);
 *  3. cópia carbono — recebe o PDF final por e-mail quando o envelope é concluído, sem assinar.
 * A URL da cerimônia da Calper é gerada à parte (gerarUrlAssinatura): é de uso único e expira em minutos.
 */
export async function criarEnvelopeEntrega({ pdfBase64, nomeDocumento, calper, cliente, conjuge = null, copia = null }) {
  const apiClient = await clienteAutenticado();
  const envelopesApi = new docusign.EnvelopesApi(apiClient);

  const documento = docusign.Document.constructFromObject({
    documentBase64: pdfBase64,
    name: nomeDocumento,
    fileExtension: 'pdf',
    documentId: '1'
  });

  const signers = [
    docusign.Signer.constructFromObject({
      email: calper.email,
      name: calper.nome,
      recipientId: '1',
      routingOrder: '1',
      clientUserId: calper.clientUserId,
      tabs: tabAssinar(ANCORA_CALPER)
    }),
    docusign.Signer.constructFromObject({
      email: cliente.email,
      name: cliente.nome,
      recipientId: '2',
      routingOrder: '2',
      tabs: tabAssinar(ANCORA_INVESTIDOR)
    })
  ];
  if (conjuge) {
    signers.push(
      docusign.Signer.constructFromObject({
        email: conjuge.email,
        name: conjuge.nome,
        recipientId: '3',
        routingOrder: '2',
        tabs: tabAssinar(ANCORA_CONJUGE)
      })
    );
  }

  // e-mails reservados para exemplos (example.com etc.) são de teste: não mandam cópia a uma pessoa real
  const todosDeTeste = [cliente, conjuge].filter(Boolean).every((p) => ehEmailDeExemplo(p.email));
  const carbonCopies =
    copia && (!todosDeTeste || ehEmailDeExemplo(copia.email))
      ? [docusign.CarbonCopy.constructFromObject({ email: copia.email, name: copia.nome, recipientId: '4', routingOrder: '3' })]
      : [];

  const envelope = docusign.EnvelopeDefinition.constructFromObject({
    emailSubject: `Calper — assine o ${nomeDocumento} da sua unidade`,
    emailBlurb:
      'A Calper já assinou. Falta a sua assinatura: abra o documento pelo botão abaixo, confira e assine. ' +
      'Dúvidas, procure a equipe Calper.',
    documents: [documento],
    recipients: docusign.Recipients.constructFromObject({ signers, carbonCopies }),
    status: 'sent'
  });

  const criado = await envelopesApi.createEnvelope(env.DOCUSIGN_ACCOUNT_ID, { envelopeDefinition: envelope });
  return { envelopeId: criado.envelopeId, comCopia: carbonCopies.length > 0 };
}

/**
 * Gera a URL (uso único, ~5 min) da cerimônia de assinatura da Calper num envelope já criado.
 * `origemApp` é a origem do Calper (ex: https://calper-mocha.vercel.app): é ela que o DocuSign
 * autoriza a embutir a cerimônia em iframe (frameAncestors) e a receber as mensagens (messageOrigins).
 * O clientUserId/e-mail/nome precisam ser exatamente os do signatário na criação do envelope.
 */
export async function gerarUrlAssinatura({ envelopeId, signatario, retornoUrl, origemApp }) {
  const apiClient = await clienteAutenticado();
  const envelopesApi = new docusign.EnvelopesApi(apiClient);

  // Em produção, o DocuSign só aceita origens https em frameAncestors — basta UMA origem http (ex: localhost)
  // na lista para ele ignorar tudo e devolver "frame-ancestors 'self'", bloqueando o iframe. O sandbox
  // (demo) aceita http, então o teste local com a conta de demonstração continua funcionando.
  const demo = env.DOCUSIGN_BASE_URI.includes('demo');
  const frameAncestors = [...new Set([origemApp, origemApps()])].filter((o) => demo || o.startsWith('https://'));

  const view = docusign.RecipientViewRequest.constructFromObject({
    returnUrl: retornoUrl,
    authenticationMethod: 'none',
    email: signatario.email,
    userName: signatario.nome,
    clientUserId: signatario.clientUserId,
    // o DocuSign exige que cada messageOrigin também esteja listado em frameAncestors
    frameAncestors,
    messageOrigins: [origemApps()]
  });
  const vista = await envelopesApi.createRecipientView(env.DOCUSIGN_ACCOUNT_ID, envelopeId, {
    recipientViewRequest: view
  });
  return vista.url;
}

/**
 * Situação do envelope: status geral, se a Calper (destinatário 1) já assinou e quem ainda falta
 * entre cliente/cônjuge (destinatários 2 e 3).
 */
export async function situacaoDoEnvelope(envelopeId) {
  const apiClient = await clienteAutenticado();
  const envelopesApi = new docusign.EnvelopesApi(apiClient);
  const [envelope, recipientes] = await Promise.all([
    envelopesApi.getEnvelope(env.DOCUSIGN_ACCOUNT_ID, envelopeId),
    envelopesApi.listRecipients(env.DOCUSIGN_ACCOUNT_ID, envelopeId)
  ]);
  const signers = recipientes.signers ?? [];
  const calper = signers.find((s) => s.recipientId === '1');
  const clientes = signers.filter((s) => s.recipientId !== '1');
  return {
    status: envelope.status,
    calperAssinou: calper?.status === 'completed',
    clientesPendentes: clientes.filter((s) => s.status !== 'completed').map((s) => ({ nome: s.name, email: s.email, status: s.status }))
  };
}

/** Status do envelope no DocuSign (ex: "sent", "completed"). */
export async function statusDoEnvelope(envelopeId) {
  return (await situacaoDoEnvelope(envelopeId)).status;
}

/** Baixa o PDF final (todos os documentos combinados) como data URL base64. */
export async function baixarPdfAssinado(envelopeId) {
  const apiClient = await clienteAutenticado();
  const envelopesApi = new docusign.EnvelopesApi(apiClient);
  const binario = await envelopesApi.getDocument(env.DOCUSIGN_ACCOUNT_ID, envelopeId, 'combined');
  const buffer = Buffer.isBuffer(binario) ? binario : Buffer.from(binario, 'binary');
  return `data:application/pdf;base64,${buffer.toString('base64')}`;
}
