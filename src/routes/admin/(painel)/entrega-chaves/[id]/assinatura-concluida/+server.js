import { error, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { NOME_DOCUMENTO, PASSO_DO_DOCUMENTO, ROTA_UNIDADE, sincronizarDocumento } from '$lib/server/entregaChaves.js';

// Retorno do DocuSign após a Calper assinar (ou cancelar). Não confia no query string:
// confere o estado real do envelope e atualiza o documento (aguardando_cliente / assinado).
export async function GET(event) {
  const { params, url, locals } = event;
  if (!locals.funcionario) throw redirect(303, '/admin/login');

  const tipo = url.searchParams.get('tipo');
  const origem = url.searchParams.get('origem') === 'unidade' ? 'unidade' : 'fluxo';
  if (!NOME_DOCUMENTO[tipo]) throw error(400, 'Documento inválido');

  const doc = await db.documentoAssinado.findUnique({
    where: { agendamentoId_tipo: { agendamentoId: params.id, tipo } },
    include: { agendamento: true }
  });
  if (!doc) throw error(404, 'Documento não encontrado');

  const unidadeId = doc.agendamento.unidadeId;
  const passoAtual = PASSO_DO_DOCUMENTO[tipo];
  // volta pra tela do próprio documento: com a Calper assinada ela mostra "aguardando o cliente" e quem foi avisado
  const voltar = (avancou, aviso) => {
    if (origem === 'unidade') {
      return `/admin/unidades/${unidadeId}/${ROTA_UNIDADE[tipo]}${aviso ? `?aviso=${aviso}` : ''}`;
    }
    const q = new URLSearchParams({ passo: String(avancou ? passoAtual + 1 : passoAtual) });
    if (aviso) q.set('aviso', aviso);
    return `/admin/entrega-chaves/${params.id}?${q}`;
  };

  const { status } = await sincronizarDocumento(doc, event);
  if (status === 'pendente') throw redirect(303, voltar(false, 'nao-assinado'));
  throw redirect(303, voltar(status === 'assinado', status === 'aguardando_cliente' ? 'aguardando-cliente' : undefined));
}
