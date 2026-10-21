import docusign from 'docusign-esign';
import { env } from '$env/dynamic/private';
import { normalizarChavePrivada } from './chavePrivada.js';
import { ANCORA } from './ancoras.js';
import { xOffsetCentralizado } from './caixaAssinatura.js';

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
 * DocuSign, mas o nome que aparece como signatário é sempre "M1 Empreendimentos" (DOCUSIGN_ASSINANTE_NOME muda).
 */
export async function assinanteDaCalper() {
  const nome = env.DOCUSIGN_ASSINANTE_NOME || 'M1 Empreendimentos';
  if (env.DOCUSIGN_ASSINANTE_EMAIL) return { nome, email: env.DOCUSIGN_ASSINANTE_EMAIL };
  return { nome, email: (await usuarioDaIntegracao()).email };
}

/** Quem recebe a cópia do documento final assinado (destinatário "cópia carbono"). */
export async function destinatarioDaCopia() {
  if (env.DOCUSIGN_EMAIL_COPIA) return { nome: 'Calper', email: env.DOCUSIGN_EMAIL_COPIA };
  const u = await usuarioDaIntegracao();
  return { nome: u.nome, email: u.email };
}


// Ids dos destinatários e dos documentos dentro do envelope único da entrega (termo = documento 1, checklist = 2).
export const DESTINATARIO = { calperTermo: '1', calperChecklist: '2', cliente: '3', conjuge: '4', copia: '5' };
export const DOCUMENTO_ID = { termo: '1', checklist: '2' };

/** clientUserId do destinatário que assina o checklist pela Calper (distinto do que assina o termo). */
export const clientUserIdChecklist = (clientUserId) => `${clientUserId}:checklist`;

const ehEmailDeExemplo = (email) => /@example\.(com|org|net)$/i.test(String(email ?? ''));

// Caixa de assinatura: ampliada (escala máxima do DocuSign é 1,5), centralizada sobre a linha de assinatura
// e encostada nela. O ponto de ancoragem é o canto superior esquerdo da caixa, na esquerda da linha.
const CAIXA = { escala: '1.5', yOffset: '-30' };
function tabAssinar(ancora, documentId, nomeDoAssinante) {
  return docusign.Tabs.constructFromObject({
    signHereTabs: [
      docusign.SignHere.constructFromObject({
        documentId,
        anchorString: ancora,
        anchorUnits: 'pixels',
        anchorXOffset: xOffsetCentralizado(nomeDoAssinante),
        anchorYOffset: CAIXA.yOffset,
        scaleValue: CAIXA.escala,
        anchorIgnoreIfNotPresent: 'false'
      })
    ]
  });
}

/**
 * Cria o envelope único da entrega, já com a ordem de assinatura completa, mas só com o TERMO dentro:
 *  1. Calper (termo) — assinatura EMBUTIDA no admin (clientUserId preenchido);
 *  2. Calper (checklist) — mesmo assinante, outra sessão embutida; fica "de guarda" na ordem 2 (só com uma
 *     caixa de texto invisível e opcional) para segurar o envelope até o checklist ser anexado (anexarChecklist);
 *  3. cliente e, se houver, cônjuge — assinatura REMOTA, ordem 3, em paralelo: só recebem o e-mail do DocuSign
 *     (um só, com os dois documentos) depois que a Calper assinou o termo E o checklist;
 *  4. cópia carbono — recebe o PDF final quando o envelope é concluído.
 * A URL da cerimônia da Calper é gerada à parte (gerarUrlAssinatura): é de uso único e expira em minutos.
 */
export async function criarEnvelopeEntrega({ pdfBase64, nomeDocumento, calper, cliente, conjuge = null, copia = null }) {
  const apiClient = await clienteAutenticado();
  const envelopesApi = new docusign.EnvelopesApi(apiClient);

  const documento = docusign.Document.constructFromObject({
    documentBase64: pdfBase64,
    name: nomeDocumento,
    fileExtension: 'pdf',
    documentId: DOCUMENTO_ID.termo
  });

  const guarda = docusign.Tabs.constructFromObject({
    textTabs: [
      docusign.Text.constructFromObject({
        documentId: DOCUMENTO_ID.termo,
        pageNumber: '1',
        xPosition: '5',
        yPosition: '5',
        width: '10',
        height: '10',
        required: 'false',
        locked: 'true',
        value: ' ',
        tabLabel: 'guarda-checklist'
      })
    ]
  });

  const signers = [
    docusign.Signer.constructFromObject({
      email: calper.email,
      name: calper.nome,
      recipientId: DESTINATARIO.calperTermo,
      routingOrder: '1',
      clientUserId: calper.clientUserId,
      tabs: tabAssinar(ANCORA.termo.calper, DOCUMENTO_ID.termo, calper.nome)
    }),
    docusign.Signer.constructFromObject({
      email: calper.email,
      name: calper.nome,
      recipientId: DESTINATARIO.calperChecklist,
      routingOrder: '2',
      clientUserId: clientUserIdChecklist(calper.clientUserId),
      tabs: guarda
    }),
    docusign.Signer.constructFromObject({
      email: cliente.email,
      name: cliente.nome,
      recipientId: DESTINATARIO.cliente,
      routingOrder: '3',
      tabs: tabAssinar(ANCORA.termo.cliente, DOCUMENTO_ID.termo, cliente.nome)
    })
  ];
  if (conjuge) {
    signers.push(
      docusign.Signer.constructFromObject({
        email: conjuge.email,
        name: conjuge.nome,
        recipientId: DESTINATARIO.conjuge,
        routingOrder: '3',
        tabs: tabAssinar(ANCORA.termo.conjuge, DOCUMENTO_ID.termo, conjuge.nome)
      })
    );
  }

  // e-mails reservados para exemplos (example.com etc.) são de teste: não mandam cópia a uma pessoa real
  const todosDeTeste = [cliente, conjuge].filter(Boolean).every((p) => ehEmailDeExemplo(p.email));
  const carbonCopies =
    copia && (!todosDeTeste || ehEmailDeExemplo(copia.email))
      ? [docusign.CarbonCopy.constructFromObject({ email: copia.email, name: copia.nome, recipientId: DESTINATARIO.copia, routingOrder: '4' })]
      : [];

  const envelope = docusign.EnvelopeDefinition.constructFromObject({
    emailSubject: 'Calper — assine o Termo de Entrega de Chaves e o Checklist da sua unidade',
    emailBlurb:
      'A Calper já assinou. Falta a sua assinatura nos dois documentos (termo e checklist): abra pelo botão abaixo, ' +
      'confira e assine. Dúvidas, procure a equipe Calper.',
    documents: [documento],
    recipients: docusign.Recipients.constructFromObject({ signers, carbonCopies }),
    status: 'sent'
  });

  const criado = await envelopesApi.createEnvelope(env.DOCUSIGN_ACCOUNT_ID, { envelopeDefinition: envelope });
  return { envelopeId: criado.envelopeId, comCopia: carbonCopies.length > 0 };
}

/**
 * Anexa o checklist (documento 2) ao envelope em andamento e posiciona as caixas de assinatura dele:
 * a da Calper (destinatário de guarda, que passa a ter o que assinar), a do cliente e a do cônjuge.
 * Só funciona enquanto o destinatário de guarda ainda não concluiu (o envelope segue aberto).
 */
export async function anexarChecklist({ envelopeId, pdfBase64, nomeDocumento, calper, cliente, conjuge = null }) {
  const apiClient = await clienteAutenticado();
  const envelopesApi = new docusign.EnvelopesApi(apiClient);
  const contaId = env.DOCUSIGN_ACCOUNT_ID;

  await envelopesApi.updateDocuments(contaId, envelopeId, {
    envelopeDefinition: docusign.EnvelopeDefinition.constructFromObject({
      documents: [
        docusign.Document.constructFromObject({
          documentBase64: pdfBase64,
          name: nomeDocumento,
          fileExtension: 'pdf',
          documentId: DOCUMENTO_ID.checklist
        })
      ]
    })
  });

  const tabs = [
    [DESTINATARIO.calperChecklist, ANCORA.checklist.calper, calper.nome],
    [DESTINATARIO.cliente, ANCORA.checklist.cliente, cliente.nome],
    ...(conjuge ? [[DESTINATARIO.conjuge, ANCORA.checklist.conjuge, conjuge.nome]] : [])
  ];
  for (const [destinatario, ancora, nome] of tabs) {
    await envelopesApi.createTabs(contaId, envelopeId, destinatario, { tabs: tabAssinar(ancora, DOCUMENTO_ID.checklist, nome) });
  }
}

/** Anula um envelope (ex.: um termo ainda não assinado que será reenviado com outro texto). Não lança. */
export async function anularEnvelope(envelopeId, motivo) {
  try {
    const apiClient = await clienteAutenticado();
    const envelopesApi = new docusign.EnvelopesApi(apiClient);
    await envelopesApi.update(env.DOCUSIGN_ACCOUNT_ID, envelopeId, {
      envelope: { status: 'voided', voidedReason: motivo }
    });
  } catch (err) {
    console.error('DocuSign (anular envelope):', err?.response?.body ?? err);
  }
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
 * Situação do envelope único: status geral, se a Calper já assinou o termo (destinatário 1) e o checklist
 * (destinatário 2) e quem ainda falta entre cliente/cônjuge (destinatários 3 e 4).
 */
export async function situacaoDoEnvelope(envelopeId) {
  const apiClient = await clienteAutenticado();
  const envelopesApi = new docusign.EnvelopesApi(apiClient);
  const [envelope, recipientes] = await Promise.all([
    envelopesApi.getEnvelope(env.DOCUSIGN_ACCOUNT_ID, envelopeId),
    envelopesApi.listRecipients(env.DOCUSIGN_ACCOUNT_ID, envelopeId)
  ]);
  const signers = recipientes.signers ?? [];
  const concluiu = (id) => signers.find((s) => s.recipientId === id)?.status === 'completed';
  const clientes = signers.filter((s) => [DESTINATARIO.cliente, DESTINATARIO.conjuge].includes(s.recipientId));
  return {
    status: envelope.status,
    calperTermoAssinou: concluiu(DESTINATARIO.calperTermo),
    calperChecklistAssinou: concluiu(DESTINATARIO.calperChecklist),
    clientesPendentes: clientes.filter((s) => s.status !== 'completed').map((s) => ({ nome: s.name, email: s.email, status: s.status }))
  };
}

/** Status do envelope no DocuSign (ex: "sent", "completed"). */
export async function statusDoEnvelope(envelopeId) {
  return (await situacaoDoEnvelope(envelopeId)).status;
}

/** Baixa um documento assinado do envelope (padrão: todos combinados) como data URL base64. */
export async function baixarPdfAssinado(envelopeId, documentId = 'combined') {
  const apiClient = await clienteAutenticado();
  const envelopesApi = new docusign.EnvelopesApi(apiClient);
  const binario = await envelopesApi.getDocument(env.DOCUSIGN_ACCOUNT_ID, envelopeId, documentId);
  const buffer = Buffer.isBuffer(binario) ? binario : Buffer.from(binario, 'binary');
  return `data:application/pdf;base64,${buffer.toString('base64')}`;
}
