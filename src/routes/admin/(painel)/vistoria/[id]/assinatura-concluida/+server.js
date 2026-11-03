import { redirect } from '@sveltejs/kit';
import { buscarVistoria, documentoDaVistoria, sincronizarTermoVistoria } from '$lib/server/vistoria.js';

// Retorno do DocuSign depois que a Calper assina (ou cancela). Não confia no query string: confere o envelope de verdade.
export async function GET(event) {
  const { params, locals } = event;
  if (!locals.funcionario) throw redirect(303, '/admin/login');
  const ag = await buscarVistoria(params.id);
  const doc = documentoDaVistoria(ag);
  if (!doc) throw redirect(303, `/admin/vistoria/${ag.id}?passo=4`);
  const { status } = await sincronizarTermoVistoria({ ...doc, agendamentoId: ag.id }, event);
  if (status === 'pendente') throw redirect(303, `/admin/vistoria/${ag.id}?passo=4&aviso=nao-assinado`);
  throw redirect(303, `/admin/vistoria/${ag.id}?passo=${status === 'assinado' ? 5 : 4}${status === 'aguardando_cliente' ? '&aviso=aguardando-cliente' : ''}`);
}
