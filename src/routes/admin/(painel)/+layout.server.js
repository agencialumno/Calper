import { redirect } from '@sveltejs/kit';
import { listarNotificacoes } from '$lib/server/notificacao.js';
import { ehAdmin, podeEditar } from '$lib/perfis.js';

export async function load({ locals }) {
  if (!locals.funcionario) throw redirect(303, '/admin/login');
  // o acesso por perfil é decidido na entrada da requisição (guardaAdmin.js); aqui só se monta o layout

  const notificacoes = await listarNotificacoes({ funcionarioId: locals.funcionario.id });

  return {
    funcionario: {
      id: locals.funcionario.id,
      nome: locals.funcionario.nome,
      perfil: locals.funcionario.perfil, // já normalizado: admin | supervisor | colaborador
      fotoVersao: locals.funcionario.fotoVersao,
      ehAdmin: ehAdmin(locals.funcionario.perfil),
      // admin e supervisor alteram dados; o colaborador só consulta
      podeEditar: podeEditar(locals.funcionario.perfil)
    },
    notificacoes
  };
}
