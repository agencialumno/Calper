// Notificações internas (sino) — complementa, não substitui, o e-mail: todo
// evento relevante fica registrado aqui pro destinatário ver dentro do
// próprio sistema, mesmo que o e-mail falhe, vá pro spam ou não seja lido.
import { db } from './db.js';
import { enviarEmail } from './email.js';

/**
 * Cria a notificação pro investidor e, se um e-mail for passado, tenta
 * enviar também. Falha de e-mail não derruba a notificação em si (ela já
 * fica salva) — só é registrada no log.
 */
export async function notificarInvestidor({ investidorId, titulo, mensagem, link = null, email = null }) {
  await db.notificacao.create({
    data: { destinatarioTipo: 'investidor', investidorId, titulo, mensagem, link }
  });

  if (email?.to) {
    try {
      await enviarEmail(email);
    } catch (err) {
      console.error('[notificacao] falha ao enviar e-mail pro investidor:', err.message);
    }
  }
}

/** Notifica todos os funcionários ativos (ou só os perfis informados). Só sino — sem e-mail, pra não virar spam do dia a dia. */
export async function notificarFuncionarios({ titulo, mensagem, link = null, perfis = null }) {
  const funcionarios = await db.funcionario.findMany({
    where: { ativo: true, ...(perfis ? { perfil: { in: perfis } } : {}) },
    select: { id: true }
  });

  if (funcionarios.length === 0) return;

  await db.notificacao.createMany({
    data: funcionarios.map((f) => ({
      destinatarioTipo: 'funcionario',
      funcionarioId: f.id,
      titulo,
      mensagem,
      link
    }))
  });
}

/** E-mail de contato do investidor NESSA unidade (cada vínculo unidade+investidor tem o seu). */
export async function emailDoInvestidorNaUnidade(investidorId, unidadeId) {
  const vinculo = await db.unidadeInvestidor.findFirst({ where: { investidorId, unidadeId } });
  return vinculo?.email ?? null;
}

/** Últimas notificações do destinatário + contagem de não lidas, pro sino. */
export async function listarNotificacoes({ investidorId, funcionarioId, limite = 15 }) {
  const where = investidorId ? { investidorId } : { funcionarioId };
  const [itens, naoLidas] = await Promise.all([
    db.notificacao.findMany({ where, orderBy: { createdAt: 'desc' }, take: limite }),
    db.notificacao.count({ where: { ...where, lida: false } })
  ]);
  return { itens, naoLidas };
}