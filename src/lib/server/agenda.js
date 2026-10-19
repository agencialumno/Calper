import { db } from './db.js';
import { SLUG_ENTREGA_CHAVES } from './entregaChaves.js';

// Agenda de entrega de chaves: quais dias estão abertos e quantos agendamentos cabem por hora.
// Tudo editável pela equipe em /admin/agenda (AgendaConfig + AgendaDia).
//
// Convenção de horário (a mesma dos agendamentos já existentes): o horário escolhido é gravado como
// "relógio UTC" em Agendamento.dataHora — "2026-10-28" + "10:00" vira 2026-10-28T10:00:00Z — e as
// telas mostram esse valor em UTC. Assim a contagem por hora é exata e independe do fuso do servidor.

export const HORARIOS_PADRAO = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];
const LIMITE_PADRAO = 4;

export const dataHoraDoSlot = (data, horario) => new Date(`${data}T${horario}:00.000Z`);

export function horarioValido(h) {
  return typeof h === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(h);
}

export function dataValida(d) {
  if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const dt = new Date(`${d}T00:00:00.000Z`);
  return !Number.isNaN(dt.getTime()) && dt.toISOString().slice(0, 10) === d;
}

export async function obterConfig() {
  const c = await db.agendaConfig.findUnique({ where: { id: 'padrao' } });
  const horarios = Array.isArray(c?.horarios) ? c.horarios.filter(horarioValido) : HORARIOS_PADRAO;
  return { limitePorHora: c?.limitePorHora ?? LIMITE_PADRAO, horarios: [...new Set(horarios)].sort() };
}

/** Limite de agendamentos de um horário de um dia: horário > dia > padrão geral. */
export function limiteDoSlot(config, dia, horario) {
  const porHorario = dia?.limitesPorHorario && typeof dia.limitesPorHorario === 'object' ? dia.limitesPorHorario[horario] : undefined;
  if (Number.isInteger(porHorario) && porHorario >= 0) return porHorario;
  if (Number.isInteger(dia?.limitePorHora) && dia.limitePorHora >= 0) return dia.limitePorHora;
  return config.limitePorHora;
}

/** Quantos agendamentos de entrega de chaves (não cancelados) já ocupam cada horário nos dias dados. */
export async function ocupacaoPorSlot(datas, cliente = db) {
  if (!datas.length) return new Map();
  const inicio = new Date(`${datas.reduce((a, b) => (a < b ? a : b))}T00:00:00.000Z`);
  const fim = new Date(`${datas.reduce((a, b) => (a > b ? a : b))}T23:59:59.999Z`);
  const ags = await cliente.agendamento.findMany({
    where: { tipoEvento: { slug: SLUG_ENTREGA_CHAVES }, status: { not: 'cancelado' }, dataHora: { gte: inicio, lte: fim } },
    select: { dataHora: true }
  });
  const mapa = new Map();
  for (const a of ags) {
    const iso = a.dataHora.toISOString();
    const chave = `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
    mapa.set(chave, (mapa.get(chave) ?? 0) + 1);
  }
  return mapa;
}

/** Dias abertos (de hoje em diante) com a vaga restante de cada horário, pro formulário público. */
export async function agendaPublica(agora = new Date()) {
  const hoje = agora.toISOString().slice(0, 10);
  const [config, dias] = await Promise.all([
    obterConfig(),
    db.agendaDia.findMany({ where: { aberto: true, data: { gte: hoje } }, orderBy: { data: 'asc' } })
  ]);
  const ocupacao = await ocupacaoPorSlot(dias.map((d) => d.data));
  return dias
    .map((d) => ({
      data: d.data,
      horarios: config.horarios
        .map((h) => ({ horario: h, restantes: Math.max(0, limiteDoSlot(config, d, h) - (ocupacao.get(`${d.data} ${h}`) ?? 0)) }))
    }))
    .filter((d) => d.horarios.some((h) => h.restantes > 0));
}

/**
 * Confere (dentro de uma transação) se o dia está aberto e se o horário ainda tem vaga.
 * Devolve { ok: true } ou { ok: false, motivo }.
 */
export async function conferirVaga(cliente, data, horario) {
  if (!dataValida(data) || !horarioValido(horario)) return { ok: false, motivo: 'Escolha uma data e um horário válidos.' };
  const [config, dia] = await Promise.all([
    cliente.agendaConfig.findUnique({ where: { id: 'padrao' } }).then((c) => ({
      limitePorHora: c?.limitePorHora ?? LIMITE_PADRAO,
      horarios: Array.isArray(c?.horarios) ? c.horarios : HORARIOS_PADRAO
    })),
    cliente.agendaDia.findUnique({ where: { data } })
  ]);
  if (!dia?.aberto) return { ok: false, motivo: 'Esta data não está disponível para agendamento.' };
  if (!config.horarios.includes(horario)) return { ok: false, motivo: 'Este horário não está disponível.' };
  const limite = limiteDoSlot(config, dia, horario);
  const ocupados = (await ocupacaoPorSlot([data], cliente)).get(`${data} ${horario}`) ?? 0;
  if (ocupados >= limite) return { ok: false, motivo: 'Este horário acabou de lotar. Escolha outro horário.' };
  return { ok: true };
}
