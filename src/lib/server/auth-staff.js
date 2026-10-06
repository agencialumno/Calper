import { randomBytes } from 'node:crypto';
import { db } from './db.js';

export const STAFF_SESSION_COOKIE = 'calper_staff_session';
const SESSION_DURATION_MS = 1000 * 60 * 60 * 12; // 12h — sessão de trabalho

export async function criarSessaoFuncionario(funcionarioId) {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await db.sessaoFuncionario.create({ data: { id: token, funcionarioId, expiresAt } });
  return { token, expiresAt };
}

export async function validarSessaoFuncionario(token) {
  if (!token) return null;
  const sessao = await db.sessaoFuncionario.findUnique({
    where: { id: token },
    include: { funcionario: true }
  });
  if (!sessao) return null;
  if (sessao.expiresAt < new Date() || !sessao.funcionario.ativo) {
    await db.sessaoFuncionario.delete({ where: { id: token } }).catch(() => {});
    return null;
  }
  return sessao;
}

export async function encerrarSessaoFuncionario(token) {
  await db.sessaoFuncionario.delete({ where: { id: token } }).catch(() => {});
}

/** Perfis com acesso a cadastro de unidades / importação em massa. */
export const PERFIS_COM_ACESSO_CADASTRO = ['admin', 'gestao'];
