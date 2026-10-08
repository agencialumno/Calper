// Envio de e-mail transacional via Resend. Sem RESEND_API_KEY configurada
// (ex: em dev), cai num modo de log — não quebra o fluxo, só avisa no console.

const EMAIL_FROM = process.env.EMAIL_FROM ?? 'Calper <atualizacoes@calper.com.br>';

// Domínio usado pra montar a URL pública da logo nos e-mails. Fica em env var
// justamente porque o domínio final vai mudar — só trocar APP_URL na Vercel
// quando migrar, sem precisar mexer em código nenhum.
const APP_URL = process.env.APP_URL ?? 'https://calper-mocha.vercel.app';
const LOGO_URL = `${APP_URL}/logo.png`;

export async function enviarEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log(`[email:dev] para=${to} assunto="${subject}" (RESEND_API_KEY não configurada — não enviado de verdade)`);
    return { enviado: true, modo: 'dev-log' };
  }

  const resposta = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: EMAIL_FROM, to, subject, html })
  });

  if (!resposta.ok) {
    const texto = await resposta.text().catch(() => '');
    throw new Error(`Falha ao enviar e-mail (${resposta.status}): ${texto}`);
  }

  return { enviado: true, modo: 'resend' };
}

// Cabeçalho com a logo, reaproveitado em todos os templates. Imagem pequena
// (só a wordmark) — nada de banner grande, pra não parecer spam nem pesar o
// carregamento.
function cabecalho() {
  return `
    <div style="margin-bottom:28px">
      <img src="${LOGO_URL}" alt="Calper" height="22" style="display:block;height:22px;width:auto" />
    </div>
  `;
}

export function templateAtualizacaoObra({ nomeInvestidor, empreendimento, titulo, descricao, emailEnviadoId }) {
  // link e pixel de rastreio só existem quando o id do EmailEnviado está disponível
  // (ou seja, quando o chamador já criou o registro antes de montar o e-mail)
  const linkJornada = emailEnviadoId
    ? `${APP_URL}/api/rastreio/clique/${emailEnviadoId}?destino=${encodeURIComponent('/jornada')}`
    : `${APP_URL}/jornada`;
  const pixelAbertura = emailEnviadoId
    ? `<img src="${APP_URL}/api/rastreio/abrir/${emailEnviadoId}" width="1" height="1" alt="" style="display:block;border:0" />`
    : '';

  return `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#282e35">
      ${cabecalho()}
      <p style="font-size:14px;color:#6c7079">Olá, ${nomeInvestidor},</p>
      <p style="font-size:14px;color:#6c7079;line-height:1.6">
        O empreendimento <strong>${empreendimento}</strong> tem uma nova atualização:
      </p>
      <div style="background:#f6f6f7;border-radius:14px;padding:18px;margin:16px 0">
        <div style="font-size:16px;font-weight:700;margin-bottom:6px">${titulo}</div>
        <div style="font-size:14px;color:#44494f;line-height:1.6">${descricao}</div>
      </div>
      <p style="font-size:12px;color:#9aa0a8;margin-top:28px">
        <a href="${linkJornada}" style="color:#dd0417;font-weight:700;text-decoration:none">
          Acompanhe a jornada completa no seu painel Calper.
        </a>
      </p>
      ${pixelAbertura}
    </div>
  `;
}

function baseEmail({ nomeInvestidor, titulo, corpo, linkHref, linkTexto }) {
  const href = linkHref ?? `${APP_URL}/painel`;
  const texto = linkTexto ?? 'Acessar o painel Calper';

  return `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#282e35">
      ${cabecalho()}
      <p style="font-size:14px;color:#6c7079">Olá, ${nomeInvestidor},</p>
      <div style="background:#f6f6f7;border-radius:14px;padding:18px;margin:16px 0">
        <div style="font-size:16px;font-weight:700;margin-bottom:6px">${titulo}</div>
        <div style="font-size:14px;color:#44494f;line-height:1.6">${corpo}</div>
      </div>
      <p style="margin-top:28px">
        <a
          href="${href}"
          style="display:inline-block;background:#dd0417;color:#ffffff;font-size:13px;font-weight:700;text-decoration:none;padding:10px 18px;border-radius:10px"
        >
          ${texto}
        </a>
      </p>
    </div>
  `;
}

export function templateAgendamentoConfirmado({ nomeInvestidor, tipoNome, unidade, data, horario, agendamentoId }) {
  return baseEmail({
    nomeInvestidor,
    titulo: `${tipoNome} confirmado`,
    corpo: `
      Seu agendamento foi confirmado com sucesso.<br /><br />
      <strong>Unidade:</strong> ${unidade}<br />
      <strong>Data:</strong> ${data}<br />
      <strong>Horário:</strong> ${horario}
    `,
    linkHref: agendamentoId ? `${APP_URL}/agendamentos/${agendamentoId}` : undefined,
    linkTexto: 'Ver agendamento no painel'
  });
}

export function templateAgendamentoCancelado({ nomeInvestidor, tipoNome, unidade, data, horario }) {
  return baseEmail({
    nomeInvestidor,
    titulo: `${tipoNome} cancelado`,
    corpo: `
      Seu agendamento foi cancelado.<br /><br />
      <strong>Unidade:</strong> ${unidade}<br />
      <strong>Data:</strong> ${data}<br />
      <strong>Horário:</strong> ${horario}<br /><br />
      Se foi engano, você pode marcar um novo horário a qualquer momento pelo painel.
    `,
    linkTexto: 'Agendar novamente'
  });
}

export function templateLembreteVisita({ nomeInvestidor, tipoNome, unidade, data, horario, agendamentoId }) {
  return baseEmail({
    nomeInvestidor,
    titulo: `Lembrete: ${tipoNome} amanhã`,
    corpo: `
      Passando pra lembrar do seu agendamento de amanhã.<br /><br />
      <strong>Unidade:</strong> ${unidade}<br />
      <strong>Data:</strong> ${data}<br />
      <strong>Horário:</strong> ${horario}
    `,
    linkHref: agendamentoId ? `${APP_URL}/agendamentos/${agendamentoId}` : undefined,
    linkTexto: 'Ver agendamento no painel'
  });
}

export function templatePesquisaDisponivel({ nomeInvestidor, tipoNome, agendamentoId }) {
  return baseEmail({
    nomeInvestidor,
    titulo: 'Como foi sua visita?',
    corpo: `
      Seu check-in de "${tipoNome}" foi realizado. Conta pra gente como foi —
      leva menos de um minuto e ajuda a melhorar a experiência da Calper.
    `,
    linkHref: agendamentoId ? `${APP_URL}/pesquisa/${agendamentoId}` : undefined,
    linkTexto: 'Responder pesquisa'
  });
}