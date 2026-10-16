import { error, fail } from '@sveltejs/kit';
import { montarDocumento } from './documentos.js';
import {
  agendamentoAtivoDaUnidade,
  enviarDocumentoParaAssinatura,
  procuracaoValidaParaRetirante,
  retiranteDoAgendamento
} from './entregaChaves.js';

// Lógica compartilhada das rotas /admin/unidades/[id]/termo-entrega e /checklist:
// texto preenchido + estado da assinatura (DocuSign) vinculado ao agendamento de entrega da unidade.

export async function carregarDocumentoUnidade(unidadeId, tipo, url) {
  const agendamento = await agendamentoAtivoDaUnidade(unidadeId);
  const retirante = agendamento ? retiranteDoAgendamento(agendamento) : null;

  let doc;
  try {
    doc = await montarDocumento(unidadeId, tipo, { retirante });
  } catch {
    throw error(404, 'Unidade não encontrada');
  }

  let bloqueio = null;
  if (!agendamento) {
    bloqueio = 'Esta unidade não tem agendamento de entrega de chaves em aberto — agende pelo formulário de entrega de chaves.';
  } else if (!retirante) {
    bloqueio = 'Confirme quem retira as chaves (passo 2 do fluxo de entrega) antes de enviar para assinatura.';
  } else if (retirante.vinculo === 'procurador' && !procuracaoValidaParaRetirante(agendamento, retirante.cpf)) {
    bloqueio = 'Quem retira é procurador: anexe a procuração no passo 2 do fluxo de entrega.';
  }

  return {
    texto: doc.texto,
    unidadeId: doc.unidade.id,
    rotuloUnidade: `Unidade ${doc.unidade.numero} — Bloco ${doc.unidade.bloco}`,
    aviso: url.searchParams.get('aviso'),
    assinatura: {
      agendamentoId: agendamento?.id ?? null,
      status: agendamento?.documentosAssinados.find((d) => d.tipo === tipo)?.status ?? null,
      retirante: retirante ? { nome: retirante.nome, email: retirante.email, vinculo: retirante.vinculo } : null,
      agendadoPor: agendamento?.nomeCompareceu ?? null,
      bloqueio
    }
  };
}

/** Action `enviar`: manda o texto (editado na tela) pro DocuSign. Redireciona em caso de sucesso. */
export async function enviarDocumentoUnidade(event, tipo) {
  const agendamento = await agendamentoAtivoDaUnidade(event.params.id);
  if (!agendamento) return fail(400, { erro: 'Esta unidade não tem agendamento de entrega de chaves em aberto.' });

  const form = await event.request.formData();
  const resultado = await enviarDocumentoParaAssinatura(event, {
    agendamentoId: agendamento.id,
    tipo,
    texto: String(form.get('texto') ?? ''),
    origem: 'unidade'
  });
  return fail(400, { erro: resultado.erro });
}
