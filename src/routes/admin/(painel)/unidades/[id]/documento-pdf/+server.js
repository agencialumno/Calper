import { error, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { gerarPdfBase64 } from '$lib/server/documentos.js';

const NOMES = {
  termo: { titulo: 'Termo de Entrega de Chaves', arquivo: 'termo-entrega-chaves' },
  checklist: { titulo: 'Checklist - Entrega de Chaves', arquivo: 'checklist-entrega-chaves' }
};

// Converte o texto (possivelmente editado na tela) em PDF pra download.
export async function POST({ request, params, locals }) {
  if (!locals.funcionario) throw redirect(303, '/admin/login');

  const form = await request.formData();
  const tipo = String(form.get('tipo') ?? '');
  const texto = String(form.get('texto') ?? '').trim();
  if (!NOMES[tipo] || !texto) throw error(400, 'Documento inválido');

  const unidade = await db.unidade.findUnique({
    where: { id: params.id },
    select: { bloco: true, numero: true }
  });
  if (!unidade) throw error(404, 'Unidade não encontrada');

  const pdf = Buffer.from(await gerarPdfBase64(texto, NOMES[tipo].titulo), 'base64');
  return new Response(pdf, {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${NOMES[tipo].arquivo}-bloco-${unidade.bloco}-${unidade.numero}.pdf"`
    }
  });
}
