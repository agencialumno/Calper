import { db } from './db.js';
import { conferirVaga, dataHoraDoSlot } from './agenda.js';
import { SLUG_ENTREGA_CHAVES, buscarMurano } from './entregaChaves.js';
import { registrarLog, rotuloFuncionario } from './log.js';
import { motivoSemAgendamento } from '../unidadeAgendavel.js';
import { motivoBloqueio, podeGerirAgendamentos, rotuloDataHora, validarMotivo } from '../gestaoAgendamento.js';

// Alterar (trocar a unidade), Remarcar (data/hora) e Desmarcar (cancelar) agendamentos de entrega de chaves.
// Só admin e supervisor. Tudo dentro de transação serializável, com a regra "1 unidade = 1 agendamento de entrega de
// chaves" conferida de novo lá dentro (clique duplo, duas pessoas ao mesmo tempo). NENHUM registro é apagado.
// Não envia e-mail nem notificação ao investidor (ver a descrição do PR).

const ESTADO_AGENDAMENTO = {
  tipoEvento: true,
  unidade: { select: { id: true, bloco: true, numero: true, empreendimentoId: true } },
  _count: { select: { presencas: true, documentosAssinados: true } }
};

const rotuloUnidade = (u) => `Unidade ${u.numero}, Bloco ${u.bloco}`;

/** Estado do agendamento no formato que motivoBloqueio entende. */
export const estadoParaBloqueio = (ag) => ({
  status: ag.status,
  origem: ag.origem,
  checkinEm: ag.checkinEm,
  retiranteNome: ag.retiranteNome,
  observacoesAtendimento: ag.observacoesAtendimento,
  presencas: ag._count?.presencas ?? 0,
  documentos: ag._count?.documentosAssinados ?? 0
});

const TENTE_DE_NOVO = 'Outra pessoa alterou este agendamento ao mesmo tempo. Nada foi gravado: confira a tela e tente de novo.';

/** Roda a operação numa transação serializável; conflito de concorrência vira uma mensagem clara. */
async function emTransacao(operacao) {
  try {
    return await db.$transaction(operacao, { isolationLevel: 'Serializable' });
  } catch (err) {
    if (err?.code === 'P2034') return { erro: TENTE_DE_NOVO };
    throw err;
  }
}

function exigirPermissao(locals) {
  if (!locals.funcionario || !podeGerirAgendamentos(locals.funcionario.perfil)) {
    return { erro: 'Só admin e supervisor podem alterar, remarcar ou desmarcar agendamentos.', status: 403 };
  }
  return null;
}

async function historico(tx, unidadeId, descricao, funcionarioId) {
  await tx.historicoUnidade.create({ data: { unidadeId, tipo: 'outro', descricao, criadoPorId: funcionarioId } });
}

/**
 * Alterar: troca a unidade do agendamento (mesmo tipo de evento, mesma data e hora). A unidade nova passa nas
 * mesmas regras do agendamento público; a antiga volta a ficar disponível. Os arquivos (identidade/procuração) ficam
 * como estão — pertencem à unidade antiga, e a tela pede novo envio para a nova.
 */
export async function alterarUnidade(event, { agendamentoId, novaUnidadeId }) {
  const negado = exigirPermissao(event.locals);
  if (negado) return negado;
  const funcionario = event.locals.funcionario;

  const resultado = await emTransacao(async (tx) => {
    const ag = await tx.agendamento.findUnique({ where: { id: String(agendamentoId ?? '') }, include: ESTADO_AGENDAMENTO });
    if (!ag) return { erro: 'Agendamento não encontrado.' };
    const bloqueio = motivoBloqueio(estadoParaBloqueio(ag), 'alterar');
    if (bloqueio) return { erro: `Não dá para trocar a unidade: ${bloqueio}.` };

    const nova = await tx.unidade.findUnique({ where: { id: String(novaUnidadeId ?? '') } });
    if (!nova) return { erro: 'Escolha a unidade nova.' };
    if (nova.id === ag.unidadeId) return { erro: 'Essa já é a unidade do agendamento.' };
    // as mesmas travas do agendamento público
    const murano = await buscarMurano();
    if (!murano || nova.empreendimentoId !== murano.id) return { erro: 'A unidade nova não é do empreendimento da entrega de chaves.' };
    const fora = motivoSemAgendamento({ vistoriaStatus: nova.vistoriaStatus ?? null, compradores: nova.compradores });
    if (fora) return { erro: `A unidade nova está fora do agendamento (${fora}).` };
    // 1 unidade = 1 agendamento ativo do mesmo tipo (conferido DENTRO da transação)
    const ja = await tx.agendamento.findFirst({
      where: { unidadeId: nova.id, tipoEventoId: ag.tipoEventoId, status: { not: 'cancelado' }, id: { not: ag.id } },
      select: { id: true }
    });
    if (ja) return { erro: 'A unidade nova já tem agendamento de entrega de chaves. Escolha outra.' };

    const veioDe = ag.unidade;
    await tx.agendamento.update({
      where: { id: ag.id },
      data: { unidadeId: nova.id, unidadeOriginalId: ag.unidadeOriginalId ?? veioDe.id }
    });
    const quando = rotuloDataHora(ag.dataHora);
    await historico(tx, veioDe.id, `Agendamento de entrega de chaves (${quando}) transferido para a ${rotuloUnidade(nova)} pela equipe; esta unidade voltou a ficar disponível`, funcionario.id);
    await historico(tx, nova.id, `Agendamento de entrega de chaves (${quando}) recebido da ${rotuloUnidade(veioDe)} por troca feita pela equipe`, funcionario.id);
    const temArquivos = Boolean(ag.documentoBase64) || Boolean(ag.procuracaoBase64);
    return { ok: true, ag, veioDe, nova, quando, temArquivos };
  });
  if (!resultado.ok) return resultado;

  const { ag, veioDe, nova, quando, temArquivos } = resultado;
  await registrarLog({
    event,
    atorTipo: 'funcionario',
    acao: 'agendamento_unidade_alterada',
    descricao: `${rotuloFuncionario(funcionario)} trocou a unidade do agendamento de ${ag.nomeCompareceu ?? '—'} (${quando}): de ${rotuloUnidade(veioDe)} para ${rotuloUnidade(nova)}`,
    entidadeTipo: 'Agendamento',
    entidadeId: ag.id
  });
  return {
    ok: true,
    mensagem: `Unidade trocada: ${rotuloUnidade(veioDe)} → ${rotuloUnidade(nova)}.${temArquivos ? ' O documento de identidade e a procuração enviados no agendamento pertencem à unidade antiga: peça novo envio para a unidade nova (o arquivo antigo foi mantido).' : ''}`
  };
}

/** Remarcar: muda data e hora (mantém a unidade) para um horário válido da agenda, respeitando a capacidade. */
export async function remarcar(event, { agendamentoId, data, horario }) {
  const negado = exigirPermissao(event.locals);
  if (negado) return negado;
  const funcionario = event.locals.funcionario;

  const resultado = await emTransacao(async (tx) => {
    const ag = await tx.agendamento.findUnique({ where: { id: String(agendamentoId ?? '') }, include: ESTADO_AGENDAMENTO });
    if (!ag) return { erro: 'Agendamento não encontrado.' };
    const bloqueio = motivoBloqueio(estadoParaBloqueio(ag), 'remarcar');
    if (bloqueio) return { erro: `Não dá para remarcar: ${bloqueio}.` };

    const novaDataHora = dataHoraDoSlot(String(data ?? ''), String(horario ?? ''));
    if (Number.isNaN(novaDataHora.getTime())) return { erro: 'Escolha uma data e um horário válidos.' };
    if (novaDataHora.getTime() === ag.dataHora.getTime()) return { erro: 'Esse já é o dia e o horário do agendamento.' };
    // só horários válidos da agenda atual (dia aberto, horário existente) e com vaga — sem contar o próprio agendamento
    const vaga = await conferirVaga(tx, String(data), String(horario), { ignorarAgendamentoId: ag.id });
    if (!vaga.ok) return { erro: vaga.motivo };

    await tx.agendamento.update({ where: { id: ag.id }, data: { dataHora: novaDataHora, lembreteEnviado: false } });
    const antes = rotuloDataHora(ag.dataHora);
    const depois = rotuloDataHora(novaDataHora);
    await historico(tx, ag.unidadeId, `Agendamento de entrega de chaves remarcado pela equipe: de ${antes} para ${depois}`, funcionario.id);
    return { ok: true, ag, antes, depois };
  });
  if (!resultado.ok) return resultado;

  const { ag, antes, depois } = resultado;
  await registrarLog({
    event,
    atorTipo: 'funcionario',
    acao: 'agendamento_remarcado',
    descricao: `${rotuloFuncionario(funcionario)} remarcou o agendamento de ${ag.nomeCompareceu ?? '—'} (${rotuloUnidade(ag.unidade)}): de ${antes} para ${depois}`,
    entidadeTipo: 'Agendamento',
    entidadeId: ag.id
  });
  return { ok: true, mensagem: `Remarcado: ${antes} → ${depois}.` };
}

/**
 * Desmarcar: o agendamento vira "cancelado" (com motivo, autor e data) — o registro, as presenças, os documentos e os
 * arquivos continuam todos guardados. A unidade volta a ficar disponível e a vaga do horário é liberada.
 */
export async function desmarcar(event, { agendamentoId, motivo }) {
  const negado = exigirPermissao(event.locals);
  if (negado) return negado;
  const funcionario = event.locals.funcionario;
  const m = validarMotivo(motivo);
  if (!m.ok) return { erro: m.erro };

  const resultado = await emTransacao(async (tx) => {
    const ag = await tx.agendamento.findUnique({ where: { id: String(agendamentoId ?? '') }, include: ESTADO_AGENDAMENTO });
    if (!ag) return { erro: 'Agendamento não encontrado.' };
    const bloqueio = motivoBloqueio(estadoParaBloqueio(ag), 'desmarcar');
    if (bloqueio) return { erro: `Não dá para desmarcar: ${bloqueio}.` };

    await tx.agendamento.update({
      where: { id: ag.id },
      data: { status: 'cancelado', canceladoPorId: funcionario.id, canceladoEm: new Date(), motivoCancelamento: m.motivo }
    });
    await historico(tx, ag.unidadeId, `Agendamento de entrega de chaves (${rotuloDataHora(ag.dataHora)}) desmarcado pela equipe. Motivo: ${m.motivo}. A unidade voltou a ficar disponível`, funcionario.id);
    return { ok: true, ag };
  });
  if (!resultado.ok) return resultado;

  const { ag } = resultado;
  await registrarLog({
    event,
    atorTipo: 'funcionario',
    acao: 'agendamento_desmarcado',
    descricao: `${rotuloFuncionario(funcionario)} desmarcou o agendamento de ${ag.nomeCompareceu ?? '—'} — ${rotuloUnidade(ag.unidade)}, ${rotuloDataHora(ag.dataHora)}. Motivo: ${m.motivo}`,
    entidadeTipo: 'Agendamento',
    entidadeId: ag.id
  });
  return { ok: true, mensagem: `Agendamento desmarcado. A ${rotuloUnidade(ag.unidade)} voltou a ficar disponível.` };
}

/** Bloqueios de cada ação para as telas (motivo ou null). */
export function bloqueiosDoAgendamento(ag) {
  const e = estadoParaBloqueio(ag);
  return { alterar: motivoBloqueio(e, 'alterar'), remarcar: motivoBloqueio(e, 'remarcar'), desmarcar: motivoBloqueio(e, 'desmarcar') };
}

/** Unidades que podem receber um agendamento: Murano, dentro do agendamento e sem agendamento ativo do tipo. */
export async function unidadesParaTroca() {
  const [murano, ocupadas] = await Promise.all([
    buscarMurano(),
    db.agendamento.findMany({
      where: { tipoEvento: { slug: SLUG_ENTREGA_CHAVES }, status: { not: 'cancelado' } },
      select: { unidadeId: true }
    })
  ]);
  if (!murano) return [];
  const ocupadasSet = new Set(ocupadas.map((a) => a.unidadeId));
  const unidades = await db.unidade.findMany({
    where: { empreendimentoId: murano.id },
    select: { id: true, bloco: true, numero: true, vistoriaStatus: true, compradores: true },
    orderBy: [{ bloco: 'asc' }, { numero: 'asc' }]
  });
  return unidades
    .filter((u) => !ocupadasSet.has(u.id) && !motivoSemAgendamento({ vistoriaStatus: u.vistoriaStatus ?? null, compradores: u.compradores }))
    .map((u) => ({ id: u.id, rotulo: `Bloco ${u.bloco} - nº ${u.numero}` }))
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR', { numeric: true }));
}

export const ESTADO_PARA_TELA = ESTADO_AGENDAMENTO;
