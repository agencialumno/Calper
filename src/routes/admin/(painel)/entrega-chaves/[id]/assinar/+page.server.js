import { error, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { gerarUrlAssinatura } from '$lib/server/docusign.js';
import { NOME_DOCUMENTO, SLUG_ENTREGA_CHAVES, retiranteDoAgendamento } from '$lib/server/entregaChaves.js';

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
  const passoAtual = tipo === 'termo' ? 3 : 4;
  const voltarPara =
    origem === 'unidade'
      ? `/admin/unidades/${unidadeId}/${tipo === 'termo' ? 'termo-entrega' : 'checklist'}`
      : `/admin/entrega-chaves/${params.id}?passo=${passoAtual}`;

  if (doc.status === 'assinado') throw redirect(303, voltarPara);

  const retirante = retiranteDoAgendamento(doc.agendamento);
  if (!retirante?.email) throw error(409, 'Quem retira as chaves não está confirmado.');

  const destino = `/admin/entrega-chaves/${params.id}/assinatura-concluida?tipo=${tipo}&origem=${origem}`;
  let urlAssinatura = null;
  let erro = null;
  try {
    urlAssinatura = await gerarUrlAssinatura({
      envelopeId: doc.docusignEnvelopeId,
      signatario: { nome: retirante.nome, email: retirante.email, clientUserId: doc.agendamento.id },
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
    signatario: retirante.nome,
    voltarPara
  };
}
