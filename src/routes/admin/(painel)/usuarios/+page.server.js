import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { gerarSenhaTemporaria, hashSenha } from '$lib/server/auth.js';
import { registrarLog, rotuloFuncionario } from '$lib/server/log.js';
import { PERFIS, ROTULO_PERFIL, normalizarPerfil } from '$lib/perfis.js';

// Gestão de usuários da equipe — só perfil admin (a guarda de /admin já barra os demais).
// Também mostra quem está logado agora: sessões ainda válidas e a última atividade registrada.

const ONLINE_MS = 5 * 60 * 1000; // atividade nos últimos 5 minutos = "online agora"

export async function load() {
  const agora = new Date();
  const [funcionarios, sessoes] = await Promise.all([
    db.funcionario.findMany({
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true, email: true, perfil: true, ativo: true, createdAt: true, foto: { select: { atualizadoEm: true } } }
    }),
    db.sessaoFuncionario.findMany({ where: { expiresAt: { gt: agora } }, select: { funcionarioId: true, createdAt: true, ultimaAtividadeEm: true } })
  ]);

  const porUsuario = new Map();
  for (const s of sessoes) {
    const atividade = s.ultimaAtividadeEm ?? s.createdAt;
    const atual = porUsuario.get(s.funcionarioId) ?? { sessoes: 0, desde: s.createdAt, ultima: atividade };
    atual.sessoes++;
    if (s.createdAt < atual.desde) atual.desde = s.createdAt;
    if (atividade > atual.ultima) atual.ultima = atividade;
    porUsuario.set(s.funcionarioId, atual);
  }

  const usuarios = funcionarios.map((f) => {
    const s = porUsuario.get(f.id);
    return {
      id: f.id,
      nome: f.nome,
      email: f.email,
      perfil: normalizarPerfil(f.perfil),
      ativo: f.ativo,
      fotoVersao: f.foto?.atualizadoEm?.getTime() ?? null,
      sessoes: s?.sessoes ?? 0,
      logadoDesde: s?.desde ?? null,
      ultimaAtividade: s?.ultima ?? null,
      online: s ? agora.getTime() - s.ultima.getTime() <= ONLINE_MS : false
    };
  });

  return {
    usuarios,
    perfis: PERFIS.map((p) => ({ valor: p, rotulo: ROTULO_PERFIL[p] })),
    totalOnline: usuarios.filter((u) => u.online).length
  };
}

const quantosAdminsAtivos = async (exceto) =>
  db.funcionario.count({ where: { ativo: true, perfil: 'admin', ...(exceto ? { id: { not: exceto } } : {}) } });

async function alvo(event) {
  const form = await event.request.formData();
  const id = String(form.get('id') ?? '');
  const funcionario = await db.funcionario.findUnique({ where: { id } });
  return { form, funcionario };
}

export const actions = {
  alterarPerfil: async (event) => {
    const { form, funcionario } = await alvo(event);
    if (!funcionario) return fail(404, { erro: 'Usuário não encontrado.' });
    const perfil = String(form.get('perfil') ?? '');
    if (!PERFIS.includes(perfil)) return fail(400, { erro: 'Perfil inválido.' });
    const atual = normalizarPerfil(funcionario.perfil);
    if (perfil === atual && funcionario.perfil === perfil) return { sucesso: 'Nada a alterar.' };

    // nunca deixa o sistema sem admin (nem o próprio admin se rebaixa: pediria a outro admin)
    if (atual === 'admin' && perfil !== 'admin') {
      if (funcionario.id === event.locals.funcionario.id) return fail(400, { erro: 'Você não pode rebaixar o seu próprio perfil. Peça a outro admin.' });
      if ((await quantosAdminsAtivos(funcionario.id)) === 0) return fail(400, { erro: 'O sistema precisa ter ao menos um admin ativo.' });
    }

    await db.funcionario.update({ where: { id: funcionario.id }, data: { perfil } });
    await registrarLog({
      event,
      atorTipo: 'funcionario',
      acao: 'perfil_alterado',
      descricao: `${rotuloFuncionario(event.locals.funcionario)} alterou o perfil de ${funcionario.nome} (${funcionario.email}) de ${ROTULO_PERFIL[atual]} para ${ROTULO_PERFIL[perfil]}`,
      entidadeTipo: 'Funcionario',
      entidadeId: funcionario.id
    });
    return { sucesso: `${funcionario.nome} agora é ${ROTULO_PERFIL[perfil]}.` };
  },

  alternarAtivo: async (event) => {
    const { funcionario } = await alvo(event);
    if (!funcionario) return fail(404, { erro: 'Usuário não encontrado.' });
    const ativar = !funcionario.ativo;
    if (!ativar) {
      if (funcionario.id === event.locals.funcionario.id) return fail(400, { erro: 'Você não pode desativar a própria conta.' });
      if (normalizarPerfil(funcionario.perfil) === 'admin' && (await quantosAdminsAtivos(funcionario.id)) === 0) {
        return fail(400, { erro: 'O sistema precisa ter ao menos um admin ativo.' });
      }
    }
    await db.funcionario.update({ where: { id: funcionario.id }, data: { ativo: ativar } });
    if (!ativar) await db.sessaoFuncionario.deleteMany({ where: { funcionarioId: funcionario.id } });
    await registrarLog({
      event,
      atorTipo: 'funcionario',
      acao: ativar ? 'usuario_ativado' : 'usuario_desativado',
      descricao: `${rotuloFuncionario(event.locals.funcionario)} ${ativar ? 'reativou' : 'desativou'} a conta de ${funcionario.nome} (${funcionario.email})`,
      entidadeTipo: 'Funcionario',
      entidadeId: funcionario.id
    });
    return { sucesso: `Conta de ${funcionario.nome} ${ativar ? 'reativada' : 'desativada'}.` };
  },

  // Antes só dava pra fazer pelo banco: gera uma senha temporária, mostra UMA vez e derruba as sessões da pessoa.
  redefinirSenha: async (event) => {
    const { funcionario } = await alvo(event);
    if (!funcionario) return fail(404, { erro: 'Usuário não encontrado.' });
    const temporaria = gerarSenhaTemporaria();
    await db.funcionario.update({ where: { id: funcionario.id }, data: { senhaHash: hashSenha(temporaria) } });
    await db.sessaoFuncionario.deleteMany({ where: { funcionarioId: funcionario.id } });
    await registrarLog({
      event,
      atorTipo: 'funcionario',
      acao: 'senha_redefinida',
      descricao: `${rotuloFuncionario(event.locals.funcionario)} redefiniu a senha de ${funcionario.nome} (${funcionario.email}) e encerrou as sessões dela`,
      entidadeTipo: 'Funcionario',
      entidadeId: funcionario.id
    });
    return { senhaTemporaria: { nome: funcionario.nome, email: funcionario.email, senha: temporaria } };
  },

  encerrarSessoes: async (event) => {
    const { funcionario } = await alvo(event);
    if (!funcionario) return fail(404, { erro: 'Usuário não encontrado.' });
    const { count } = await db.sessaoFuncionario.deleteMany({ where: { funcionarioId: funcionario.id } });
    await registrarLog({
      event,
      atorTipo: 'funcionario',
      acao: 'sessoes_encerradas',
      descricao: `${rotuloFuncionario(event.locals.funcionario)} encerrou ${count} sessão(ões) de ${funcionario.nome} (${funcionario.email})`,
      entidadeTipo: 'Funcionario',
      entidadeId: funcionario.id
    });
    return { sucesso: `${count} sessão(ões) de ${funcionario.nome} encerrada(s).` };
  }
};
