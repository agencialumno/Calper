import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { db } from './db.js';
import { cpfValido, formatarCpf } from '../cpf.js';

export { cpfValido, formatarCpf };

export const SESSION_COOKIE = 'calper_session';
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7; // 7 dias

/** Gera o hash de uma senha no formato "salt:hash" (scrypt). */
export function hashSenha(senha) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(senha, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

/** Gera uma senha temporária legível (usada na importação em massa / 1º acesso). */
export function gerarSenhaTemporaria() {
  return randomBytes(6).toString('base64url'); // ex: "k9Lp2Qa1"
}

/** Confere uma senha em texto puro contra o hash salvo. */
export function verificarSenha(senha, senhaHash) {
  const [salt, hashGuardado] = senhaHash.split(':');
  if (!salt || !hashGuardado) return false;
  const hashTentativa = scryptSync(senha, salt, 64);
  const bufferGuardado = Buffer.from(hashGuardado, 'hex');
  if (hashTentativa.length !== bufferGuardado.length) return false;
  return timingSafeEqual(hashTentativa, bufferGuardado);
}

/** Cria uma sessão para o investidor e devolve o token a guardar no cookie. */
export async function criarSessao(investidorId) {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await db.sessao.create({ data: { id: token, investidorId, expiresAt } });
  return { token, expiresAt };
}

/** Lê e valida a sessão a partir do token do cookie. Retorna null se inválida/expirada. */
export async function validarSessao(token) {
  if (!token) return null;
  const sessao = await db.sessao.findUnique({
    where: { id: token },
    include: { investidor: true }
  });
  if (!sessao) return null;
  if (sessao.expiresAt < new Date()) {
    await db.sessao.delete({ where: { id: token } }).catch(() => {});
    return null;
  }
  return sessao;
}

/** Associa a unidade escolhida (quando o investidor tem mais de uma) à sessão atual. */
export async function definirUnidadeNaSessao(token, unidadeId) {
  await db.sessao.update({ where: { id: token }, data: { unidadeId } });
}

export async function encerrarSessao(token) {
  await db.sessao.delete({ where: { id: token } }).catch(() => {});
}
