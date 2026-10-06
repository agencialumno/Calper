// Envio de e-mail transacional via Resend. Sem RESEND_API_KEY configurada
// (ex: em dev), cai num modo de log — não quebra o fluxo, só avisa no console.

const EMAIL_FROM = process.env.EMAIL_FROM ?? 'Calper <atualizacoes@calper.com.br>';

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

export function templateAtualizacaoObra({ nomeInvestidor, empreendimento, titulo, descricao }) {
  return `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#282e35">
      <div style="font-size:18px;font-weight:800;letter-spacing:.5px;margin-bottom:24px">CALPER</div>
      <p style="font-size:14px;color:#6c7079">Olá, ${nomeInvestidor},</p>
      <p style="font-size:14px;color:#6c7079;line-height:1.6">
        O empreendimento <strong>${empreendimento}</strong> tem uma nova atualização:
      </p>
      <div style="background:#f6f6f7;border-radius:14px;padding:18px;margin:16px 0">
        <div style="font-size:16px;font-weight:700;margin-bottom:6px">${titulo}</div>
        <div style="font-size:14px;color:#44494f;line-height:1.6">${descricao}</div>
      </div>
      <p style="font-size:12px;color:#9aa0a8;margin-top:28px">
        Acompanhe a jornada completa no seu painel Calper.
      </p>
    </div>
  `;
}