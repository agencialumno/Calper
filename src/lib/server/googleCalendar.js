// Integração com Google Calendar via Conta de Serviço (sem login interativo).
// Usa JWT assinado com a chave privada da conta de serviço pra pegar um
// access token, e a partir daí chama a API REST do Calendar diretamente —
// evita adicionar a dependência pesada "googleapis" só pra isso.
import { env } from '$env/dynamic/private';
import { createSign } from 'node:crypto';

const SCOPE = 'https://www.googleapis.com/auth/calendar';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

let cachedToken = null; // { accessToken, expiresAt }

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function obterAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.accessToken;
  }

  const email = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const chavePrivada = env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!email || !chavePrivada) {
    throw new Error(
      'Credenciais do Google Calendar não configuradas (GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY).'
    );
  }

  const agora = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: agora,
    exp: agora + 3600
  };

  const naoAssinado = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const assinatura = createSign('RSA-SHA256')
    .update(naoAssinado)
    .sign(chavePrivada, 'base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  const jwt = `${naoAssinado}.${assinatura}`;

  const resp = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  if (!resp.ok) {
    throw new Error(`Falha ao autenticar com o Google: ${await resp.text()}`);
  }

  const data = await resp.json();
  cachedToken = { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.accessToken;
}

function calendarId() {
  const id = env.GOOGLE_CALENDAR_ID;
  if (!id) throw new Error('GOOGLE_CALENDAR_ID não configurado.');
  return id;
}

/** Verdadeiro se já existe algum evento ocupando esse intervalo no calendário da Calper. */
export async function horarioOcupado(inicio, fim) {
  try {
    const token = await obterAccessToken();
    const resp = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        timeMin: inicio.toISOString(),
        timeMax: fim.toISOString(),
        items: [{ id: calendarId() }]
      })
    });
    if (!resp.ok) throw new Error(await resp.text());
    const data = await resp.json();
    const ocupados = data.calendars?.[calendarId()]?.busy ?? [];
    return ocupados.length > 0;
  } catch (err) {
    // Se o Google Calendar estiver fora do ar ou mal configurado, não travamos
    // o agendamento do investidor por causa disso — só registramos o erro e
    // deixamos passar (fail-open). Preferível a derrubar o agendamento inteiro.
    console.error('[googleCalendar] falha ao checar disponibilidade:', err.message);
    return false;
  }
}

/** Cria um evento no calendário da Calper e devolve o ID do evento criado (ou null se falhar). */
export async function criarEvento({ titulo, descricao, inicio, fim }) {
  try {
    const token = await obterAccessToken();
    const resp = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId())}/events`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          summary: titulo,
          description: descricao,
          start: { dateTime: inicio.toISOString() },
          end: { dateTime: fim.toISOString() }
        })
      }
    );
    if (!resp.ok) throw new Error(await resp.text());
    const data = await resp.json();
    return data.id ?? null;
  } catch (err) {
    console.error('[googleCalendar] falha ao criar evento:', err.message);
    return null;
  }
}

/** Remove um evento do calendário (ex: quando o agendamento é cancelado). */
export async function removerEvento(eventId) {
  if (!eventId) return;
  try {
    const token = await obterAccessToken();
    await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId())}/events/${eventId}`,
      { method: 'DELETE', headers: { authorization: `Bearer ${token}` } }
    );
  } catch (err) {
    console.error('[googleCalendar] falha ao remover evento:', err.message);
  }
}