import { randomBytes } from 'node:crypto';
import { db } from './db.js';
import { normalizarPerfil } from '../perfis.js';

export const STAFF_SESSION_COOKIE = 'calper_staff_session';
const SESSION_DURATION_MS = 1000 * 60 * 60 * 12; // 12h — sessão de trabalho

export async function criarSessaoFuncionario(funcionarioId) {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await db.sessaoFuncionario.create({ data: { id: token, funcionarioId, expiresAt } });
  return { token, expiresAt };
}

const INTERVALO_ATIVIDADE_MS = 60 * 1000;

export async function validarSessaoFuncionario(token) {
  if (!token) return null;
  // campos explícitos (sem a foto de perfil, que é grande): esta consulta roda a cada requisição da equipe
  const sessao = await db.sessaoFuncionario.findUnique({
    where: { id: token },
    include: {
      funcionario: {
        select: { id: true, nome: true, email: true, perfil: true, ativo: true, foto: { select: { atualizadoEm: true } } }
      }
    }
  });
  if (!sessao) return null;
  if (sessao.expiresAt < new Date() || !sessao.funcionario.ativo) {
    await db.sessaoFuncionario.delete({ where: { id: token } }).catch(() => {});
    return null;
  }

  // "logado agora": registra a atividade no máximo uma vez por minuto
  const ultima = sessao.ultimaAtividadeEm ?? sessao.createdAt;
  if (Date.now() - ultima.getTime() > INTERVALO_ATIVIDADE_MS) {
    await db.sessaoFuncionario.update({ where: { id: token }, data: { ultimaAtividadeEm: new Date() } }).catch(() => {});
  }

  const f = sessao.funcionario;
  return {
    ...sessao,
    funcionario: {
      id: f.id,
      nome: f.nome,
      email: f.email,
      ativo: f.ativo,
      perfil: normalizarPerfil(f.perfil), // "gestao"/"atendimento" antigos viram supervisor/colaborador
      perfilGravado: f.perfil,
      fotoVersao: f.foto?.atualizadoEm?.getTime() ?? null
    }
  };
}

export async function encerrarSessaoFuncionario(token) {
  await db.sessaoFuncionario.delete({ where: { id: token } }).catch(() => {});
}

/** Perfis que podem alterar dados (cadastro de unidades, importação...): admin e supervisor (e o antigo "gestao"). */
export const PERFIS_COM_ACESSO_CADASTRO = ['admin', 'supervisor', 'gestao'];
