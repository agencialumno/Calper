import { redirect } from '@sveltejs/kit';
import { db } from './db.js';
import { hashSenha, gerarSenhaTemporaria } from './auth.js';
import { agoraComoRelogioDeBrasilia } from './agenda.js';
import { gerarQrToken } from './agendamento.js';
import { SLUG_ENTREGA_CHAVES, buscarMurano } from './entregaChaves.js';
import { registrarLog, rotuloFuncionario } from './log.js';
import { CPF_TECNICO, ORIGEM_DIRETO, ROTULO_DIRETO, avaliarAtendimentoDireto } from '../atendimentoDireto.js';

async function investidorTecnico() {
  return (
    (await db.investidor.findUnique({ where: { cpf: CPF_TECNICO } })) ??
    (await db.investidor.create({
      data: { nome: `${ROTULO_DIRETO} (sem agendamento)`, cpf: CPF_TECNICO, senhaHash: hashSenha(gerarSenhaTemporaria()), primeiroAcesso: false }
    }))
  );
}

/** Agendamento (não cancelado) de entrega de chaves de cada unidade: { unidadeId → { id, status } }. */
export async function agendamentosAtivosPorUnidade(unidadeIds = null) {
  const lista = await db.agendamento.findMany({
    where: { tipoEvento: { slug: SLUG_ENTREGA_CHAVES }, status: { not: 'cancelado' }, ...(unidadeIds ? { unidadeId: { in: unidadeIds } } : {}) },
    select: { id: true, unidadeId: true, status: true }
  });
  return new Map(lista.map((a) => [a.unidadeId, a]));
}

/** Situação do botão "Iniciar atendimento" de uma unidade (para as telas): abrir, iniciar ou bloqueada (com o motivo). */
export function atendimentoDaUnidade(unidade, agendamentoAtivo, muranoId) {
  return avaliarAtendimentoDireto({ unidade, agendamentoExistente: agendamentoAtivo ?? null, ehMurano: unidade.empreendimentoId === muranoId });
}

/**
 * Cria na hora o agendamento de entrega de chaves da unidade (dia e hora de agora, check-in feito, atendimento aberto)
 * e leva ao início do fluxo normal de atendimento. Se a unidade já tem agendamento, abre o existente.
 * Devolve { erro } quando não pode iniciar; em caso de sucesso, lança o redirect para o atendimento.
 */
export async function iniciarAtendimentoDireto(event, unidadeId) {
  const { locals } = event;
  const [murano, tipoEvento, unidade] = await Promise.all([
    buscarMurano(),
    db.tipoEvento.findUnique({ where: { slug: SLUG_ENTREGA_CHAVES } }),
    db.unidade.findUnique({ where: { id: String(unidadeId ?? '') } })
  ]);
  if (!murano || !tipoEvento) return { erro: 'Entrega de chaves indisponível no momento.' };
  if (!unidade) return { erro: 'Unidade não encontrada.' };

  const abrir = (id) => redirect(303, `/admin/entrega-chaves/${id}`);
  const existente = (await agendamentosAtivosPorUnidade([unidade.id])).get(unidade.id) ?? null;
  const decisao = atendimentoDaUnidade(unidade, existente, murano.id);
  if (decisao.acao === 'abrir') throw abrir(decisao.agendamentoId);
  if (decisao.acao === 'bloqueada') return { erro: `Esta unidade não inicia atendimento: ${decisao.motivo}.` };

  const investidor = await investidorTecnico();
  const agora = new Date();
  let criado;
  try {
    // 1 unidade = 1 agendamento de entrega de chaves: confere de novo dentro da transação (duplo clique, duas pessoas)
    criado = await db.$transaction(
      async (tx) => {
        const ja = await tx.agendamento.findFirst({
          where: { unidadeId: unidade.id, tipoEventoId: tipoEvento.id, status: { not: 'cancelado' } },
          select: { id: true }
        });
        if (ja) return { jaExistia: ja.id };
        const ag = await tx.agendamento.create({
          data: {
            unidadeId: unidade.id,
            tipoEventoId: tipoEvento.id,
            investidorId: investidor.id,
            dataHora: agoraComoRelogioDeBrasilia(agora), // a mesma convenção dos agendamentos: relógio de Brasília gravado como UTC
            status: 'confirmado', // atendimento aberto; vira "realizado" quando termo e checklist forem assinados por todos
            qrToken: gerarQrToken(),
            nomeCompareceu: ROTULO_DIRETO,
            origem: ORIGEM_DIRETO,
            checkinEm: agora
          }
        });
        await tx.historicoUnidade.create({
          data: {
            unidadeId: unidade.id,
            tipo: 'outro',
            descricao: 'Atendimento de entrega de chaves iniciado direto pela equipe, sem agendamento prévio (check-in realizado na hora)',
            criadoPorId: locals.funcionario.id
          }
        });
        return { ag };
      },
      { isolationLevel: 'Serializable' }
    );
  } catch (err) {
    // conflito de serialização = outra pessoa criou no mesmo instante: abre o que ela criou
    const agora2 = (await agendamentosAtivosPorUnidade([unidade.id])).get(unidade.id);
    if (agora2) throw abrir(agora2.id);
    console.error('Atendimento direto:', err);
    return { erro: 'Não foi possível iniciar o atendimento. Tente novamente.' };
  }
  if (criado.jaExistia) throw abrir(criado.jaExistia);

  await registrarLog({
    event,
    atorTipo: 'funcionario',
    acao: 'atendimento_direto_iniciado',
    descricao: `${rotuloFuncionario(locals.funcionario)} iniciou atendimento direto de entrega de chaves (sem agendamento prévio) — Unidade ${unidade.numero}, Bloco ${unidade.bloco}`,
    entidadeTipo: 'Agendamento',
    entidadeId: criado.ag.id
  });
  throw redirect(303, `/admin/entrega-chaves/${criado.ag.id}?passo=1`);
}
