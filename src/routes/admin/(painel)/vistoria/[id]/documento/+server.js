import { error, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { SLUG_VISTORIA } from '$lib/servicos.js';
import { TIPO_DOCUMENTO_VISTORIA } from '$lib/vistoria.js';

// PDF assinado do Termo de Recebimento do Imóvel (só existe depois que todos assinaram).
export async function GET({ params, locals }) {
  if (!locals.funcionario) throw redirect(303, '/admin/login');
  const ag = await db.agendamento.findUnique({
    where: { id: params.id },
    select: {
      tipoEvento: { select: { slug: true } },
      unidade: { select: { bloco: true, numero: true } },
      documentosAssinados: { where: { tipo: TIPO_DOCUMENTO_VISTORIA, status: 'assinado' }, select: { pdfBase64: true } }
    }
  });
  if (!ag || ag.tipoEvento.slug !== SLUG_VISTORIA) throw error(404, 'Agendamento de vistoria não encontrado');
  const doc = ag.documentosAssinados.find((d) => d.pdfBase64);
  if (!doc) throw error(404, 'Documento ainda não assinado');
  return new Response(Buffer.from(doc.pdfBase64.split(',')[1], 'base64'), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="termo-recebimento-imovel-bloco-${ag.unidade.bloco}-${ag.unidade.numero}.pdf"`
    }
  });
}
