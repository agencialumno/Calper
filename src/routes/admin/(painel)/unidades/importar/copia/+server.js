import { error, redirect } from '@sveltejs/kit';
import { copiaDosDados } from '$lib/server/importarMurano.js';
import { registrarLog, rotuloFuncionario } from '$lib/server/log.js';

// Cópia (JSON, sem arquivos nem senhas) dos dados que o modo "sobrescrever" apagaria. Só perfil admin.
export async function GET(event) {
  const { locals } = event;
  if (!locals.funcionario) throw redirect(303, '/admin/login');
  if (locals.funcionario.perfil !== 'admin') throw error(403, 'Acesso restrito a administradores.');

  const copia = await copiaDosDados();
  await registrarLog({
    event,
    atorTipo: 'funcionario',
    acao: 'copia_dados_baixada',
    descricao: `${rotuloFuncionario(locals.funcionario)} baixou a cópia dos dados da base de entrega de chaves (antes de importar)`,
    entidadeTipo: 'Unidade'
  });
  return new Response(JSON.stringify(copia, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="copia-dados-entrega-chaves-${new Date().toISOString().slice(0, 10)}.json"`
    }
  });
}
