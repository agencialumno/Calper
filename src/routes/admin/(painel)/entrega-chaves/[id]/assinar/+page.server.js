import { error, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { assinanteDaCalper, clientUserIdChecklist, gerarUrlAssinatura } from '$lib/server/docusign.js';
import { NOME_DOCUMENTO, PASSO_DO_DOCUMENTO, SLUG_ENTREGA_CHAVES } from '$lib/server/entregaChaves.js';

// Tela que embute a cerimônia de assinatura do DocuSign num iframe, sem tirar o atendente do admin.
// A URL do DocuSign é de uso único e expira em minutos, então é gerada a cada abertura da tela
// (recarregar a página gera uma nova).
export async function load({ params, url }) {
  const tipo = url.searchParams.get('tipo');
  const origem = url.searchParams.get('origem') === 'unidade' ? 'unidade' : 'fluxo';
  if (!NOME_DOCUMENTO[tipo]) throw error(400, 'Documento inválido');

  const doc = await db.documentoAssinado.findUnique({
    where: { agendamentoId_tipo: { agendamentoId: params.id, tipo } },
    include: { agendamento: { include: { presencas: true, tipoEvento: true, unidade: true } } }
  });
  if (!doc || doc.agendamento.tipoEvento.slug !== SLUG_ENTREGA_CHAVES) throw error(404, 'Documento não encontrado');

  const unidadeId = doc.agendamento.unidadeId;
  const passoAtual = PASSO_DO_DOCUMENTO[tipo];
  const voltarPara =
    origem === 'unidade'
      ? `/admin/unidades/${unidadeId}/${tipo === 'termo' ? 'termo-entrega' : 'checklist'}`
      : `/admin/entrega-chaves/${params.id}?passo=${passoAtual}`;

  if (doc.status !== 'pendente') throw redirect(303, `${voltarPara}${voltarPara.includes('?') ? '&' : '?'}aviso=${doc.status === 'assinado' ? 'ja-assinado' : 'calper-assinou'}`);

  // quem assina aqui é a Calper; o cliente assina depois, no próprio dispositivo, pelo e-mail do DocuSign
  const calper = await assinanteDaCalper();

  const destino = `/admin/entrega-chaves/${params.id}/assinatura-concluida?tipo=${tipo}&origem=${origem}`;
  let urlAssinatura = null;
  let erro = null;
  try {
    urlAssinatura = await gerarUrlAssinatura({
      envelopeId: doc.docusignEnvelopeId,
      signatario: {
        nome: calper.nome,
        email: calper.email,
        // termo e checklist são duas sessões da Calper no mesmo envelope, cada uma com o seu clientUserId
        clientUserId: tipo === 'checklist' ? clientUserIdChecklist(doc.agendamento.id) : doc.agendamento.id
      },
      retornoUrl: `${url.origin}/admin/assinatura-retorno?destino=${encodeURIComponent(destino)}`,
      origemApp: url.origin
    });
  } catch (err) {
    console.error('DocuSign (URL de assinatura):', err?.response?.body ?? err);
    erro = 'Não foi possível abrir a assinatura. Tente novamente em instantes.';
  }

  return {
    urlAssinatura,
    erro,
    tituloDocumento: NOME_DOCUMENTO[tipo],
    unidade: `Bloco ${doc.agendamento.unidade.bloco} - nº ${doc.agendamento.unidade.numero}`,
    signatario: calper.nome,
    voltarPara
  };
}
