import { redirect } from '@sveltejs/kit';
import { gerarUrlAssinatura } from '$lib/server/docusign.js';
import { buscarVistoria, documentoDaVistoria } from '$lib/server/vistoria.js';
import { NOME_DOCUMENTO_VISTORIA } from '$lib/vistoria.js';

// Tela que embute a cerimônia de assinatura da Calper (o funcionário que atende) num iframe, sem sair do admin.
// A URL do DocuSign é de uso único e expira em minutos: é gerada a cada abertura.
export async function load({ params, url, locals }) {
  const ag = await buscarVistoria(params.id);
  const doc = documentoDaVistoria(ag);
  const voltarPara = `/admin/vistoria/${ag.id}?passo=4`;
  if (!doc) throw redirect(303, voltarPara);
  if (doc.status !== 'pendente') throw redirect(303, `${voltarPara}&aviso=${doc.status === 'assinado' ? 'ja-assinado' : 'calper-assinou'}`);

  // quem assina pela Calper é o funcionário logado, com o nome e o e-mail do envelope (têm que ser exatamente os da criação)
  const destino = `/admin/vistoria/${ag.id}/assinatura-concluida?x=1`;
  let urlAssinatura = null;
  let erro = null;
  try {
    urlAssinatura = await gerarUrlAssinatura({
      envelopeId: doc.docusignEnvelopeId,
      signatario: { nome: locals.funcionario.nome, email: locals.funcionario.email, clientUserId: ag.id },
      retornoUrl: `${url.origin}/admin/assinatura-retorno?destino=${encodeURIComponent(destino)}`,
      origemApp: url.origin
    });
  } catch (err) {
    console.error('DocuSign (URL de assinatura da vistoria):', err?.response?.body ?? err);
    erro = 'Não foi possível abrir a assinatura. Tente novamente em instantes.';
  }
  return {
    urlAssinatura,
    erro,
    tituloDocumento: NOME_DOCUMENTO_VISTORIA,
    unidade: `Bloco ${ag.unidade.bloco} - nº ${ag.unidade.numero}`,
    signatario: locals.funcionario.nome,
    voltarPara
  };
}
