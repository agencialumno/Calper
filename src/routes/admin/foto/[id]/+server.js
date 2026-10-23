import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';

// Foto de perfil de um usuário da equipe. A guarda de /admin já exige sessão da equipe; qualquer perfil logado
// pode ver as fotos dos colegas (aparecem na lista de usuários e na barra lateral).
export async function GET({ params }) {
  const foto = await db.funcionarioFoto.findUnique({ where: { funcionarioId: params.id } });
  if (!foto) throw error(404, 'Sem foto');
  const virgula = foto.dataUrl.indexOf(',');
  const tipo = foto.dataUrl.slice(5, foto.dataUrl.indexOf(';'));
  return new Response(Buffer.from(foto.dataUrl.slice(virgula + 1), 'base64'), {
    // a URL leva ?v=<versão>: trocar a foto muda a URL, então o navegador pode guardar por um bom tempo
    headers: { 'content-type': tipo, 'cache-control': 'private, max-age=86400' }
  });
}
