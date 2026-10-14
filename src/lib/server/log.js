import { db } from './db.js';
import { formatarCpf } from '../cpf.js';

/** "Nome (CPF 000.000.000-00)" — descrição legível de um investidor. */
export function rotuloInvestidor(investidor) {
  return `${investidor.nome} (CPF ${formatarCpf(investidor.cpf)})`;
}

/** "Nome (perfil)" — descrição legível de um funcionário. */
export function rotuloFuncionario(funcionario) {
  return `${funcionario.nome} (${funcionario.perfil})`;
}

/**
 * Registra uma ação na trilha de auditoria. Nunca lança: falha de log não pode quebrar a ação
 * principal. Por padrão o ator vem de event.locals; passe investidorId/funcionarioId quando a
 * sessão ainda não existe (ex: login) ou o ator é outro.
 * Aguarda a gravação (1 insert) em vez de fire-and-forget, porque no Vercel uma promise solta
 * pode ser cortada quando a resposta é enviada.
 */
export async function registrarLog({
  event,
  atorTipo,
  acao,
  descricao,
  entidadeTipo = null,
  entidadeId = null,
  investidorId,
  funcionarioId
}) {
  try {
    let ip = null;
    try {
      ip = event.getClientAddress();
    } catch {
      // sem endereço disponível (ex: prerender) — segue sem IP
    }

    await db.logAcesso.create({
      data: {
        atorTipo,
        investidorId: atorTipo === 'investidor' ? (investidorId ?? event.locals?.investidor?.id ?? null) : null,
        funcionarioId: atorTipo === 'funcionario' ? (funcionarioId ?? event.locals?.funcionario?.id ?? null) : null,
        acao,
        descricao,
        entidadeTipo,
        entidadeId,
        ip,
        userAgent: event.request.headers.get('user-agent')?.slice(0, 300) ?? null
      }
    });
  } catch (err) {
    console.error('registrarLog falhou:', err);
  }
}
