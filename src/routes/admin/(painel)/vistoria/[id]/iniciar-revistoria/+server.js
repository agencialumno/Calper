import { error, redirect } from '@sveltejs/kit';
import { abrirRevistoria, buscarVistoria } from '$lib/server/vistoria.js';

// "Iniciar revistoria" (unidade e dossiê): cria e inicia direto o atendimento da revistoria (nº seguinte, como o atendimento
// direto). Quem conduz atendimento pode usar, inclusive colaborador (o "Abrir revistoria" do resumo, com agenda, segue só
// para admin e supervisor). Só depois de uma vistoria não aceita com a ficha de reparos já assinada.
export async function POST(event) {
  const anterior = await buscarVistoria(event.params.id);
  if (anterior.status !== 'realizado') throw error(400, 'A revistoria só pode ser iniciada depois que a ficha da vistoria não aceita for assinada por todos.');
  const r = await abrirRevistoria(event, { agendamentoId: event.params.id, quando: 'agora' });
  if (r.erro) throw error(400, r.erro);
  throw redirect(303, `/admin/vistoria/${r.id}?passo=1`);
}
