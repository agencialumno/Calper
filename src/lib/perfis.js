// Perfis da equipe Calper (isomórfico: usado no servidor e no navegador).
//  - admin:       acesso total; gerencia usuários e perfis; vê os logs de auditoria.
//  - supervisor:  edita unidades, status, documentos e agenda; NÃO altera perfis de outros usuários, NÃO vê logs.
//  - colaborador: somente leitura; faz os atendimentos presenciais (entrega de chaves, check-in); NÃO vê
//                 questionários, atualizações da obra nem empreendimentos.
export const PERFIS = ['admin', 'supervisor', 'colaborador'];
export const ROTULO_PERFIL = { admin: 'Admin', supervisor: 'Supervisor', colaborador: 'Colaborador' };

// nomes antigos (ainda presentes no banco até scripts/migrar-perfis.js rodar) → perfil atual
const ALIAS = { gestao: 'supervisor', atendimento: 'colaborador' };

/** Perfil válido a partir do valor gravado no banco; valor desconhecido vira o de menor privilégio. */
export function normalizarPerfil(perfil) {
  if (PERFIS.includes(perfil)) return perfil;
  return ALIAS[perfil] ?? 'colaborador';
}

export const ehAdmin = (perfil) => normalizarPerfil(perfil) === 'admin';
/** Pode alterar dados (unidades, status, documentos, agenda...): admin e supervisor. */
export const podeEditar = (perfil) => ['admin', 'supervisor'].includes(normalizarPerfil(perfil));

const sob = (caminho, bases) => bases.some((b) => caminho === b || caminho.startsWith(`${b}/`));

// só admin
const SO_ADMIN = ['/admin/logs', '/admin/usuarios'];
// colaborador não vê (nem por URL direta)
const OCULTAS_AO_COLABORADOR = [
  '/admin/questionarios',
  '/admin/atualizacoes',
  '/admin/empreendimentos',
  '/admin/unidades/nova',
  '/admin/unidades/importar'
];
// o que o colaborador pode ENVIAR (POST etc.): conta própria e o atendimento presencial
const ESCRITA_DO_COLABORADOR = ['/admin/logout', '/admin/conta', '/admin/checkin', '/admin/entrega-chaves', '/admin/assinatura-retorno'];
const ESCRITA_DOCUMENTOS_DA_UNIDADE = /^\/admin\/unidades\/[^/]+\/(termo-entrega|checklist|documento-pdf)(\/|$)/;

/**
 * Decide o que o perfil pode fazer num caminho da área da equipe.
 * Retorna 'ok', 'sem-acesso' (a área não é do perfil) ou 'somente-leitura' (pode ver, não pode alterar).
 */
export function permissaoNoCaminho(perfilBruto, metodo, caminho) {
  const perfil = normalizarPerfil(perfilBruto);
  if (perfil === 'admin') return 'ok';
  if (sob(caminho, SO_ADMIN)) return 'sem-acesso';
  if (perfil === 'supervisor') return 'ok';

  // colaborador
  if (sob(caminho, OCULTAS_AO_COLABORADOR)) return 'sem-acesso';
  if (metodo === 'GET' || metodo === 'HEAD') return 'ok';
  if (sob(caminho, ESCRITA_DO_COLABORADOR) || ESCRITA_DOCUMENTOS_DA_UNIDADE.test(caminho)) return 'ok';
  return 'somente-leitura';
}
