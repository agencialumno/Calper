import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { dataValida, limiteDoSlot, obterConfig, ocupacaoPorSlot } from '$lib/server/agenda.js';
import { registrarLog, rotuloFuncionario } from '$lib/server/log.js';

// Agenda da VISTORIA: dias e horários próprios (tabela AgendaDiaVistoria), separados da entrega de chaves. Nasce vazia:
// nenhum dia de vistoria fica aberto até a equipe abrir aqui. Horários e limite padrão vêm do padrão geral da Agenda
// (/admin/agenda); aqui se abre o dia e se ajustam os limites DA VISTORIA (por dia e por horário). Nada é removido: fecha-se o dia.
const SERVICO = 'vistoria';
const dataBr = (d) => d.split('-').reverse().join('/');

export async function load() {
  const [config, dias] = await Promise.all([obterConfig(), db.agendaDiaVistoria.findMany({ orderBy: { data: 'asc' } })]);
  const ocupacao = await ocupacaoPorSlot(dias.map((d) => d.data), db, { servico: SERVICO });
  return {
    config,
    dias: dias.map((d) => ({
      id: d.id,
      data: d.data,
      aberto: d.aberto,
      limitePorHora: d.limitePorHora,
      horarios: config.horarios.map((h) => ({
        horario: h,
        ocupados: ocupacao.get(`${d.data} ${h}`) ?? 0,
        limite: limiteDoSlot(config, d, h),
        sobreposto: Number.isInteger(d.limitesPorHorario?.[h])
      }))
    }))
  };
}

const inteiro = (v) => {
  const texto = String(v ?? '').trim();
  const n = Number(texto);
  return texto !== '' && Number.isInteger(n) && n >= 0 && n <= 99 ? n : null;
};

export const actions = {
  adicionarDia: async (event) => {
    const form = await event.request.formData();
    const data = String(form.get('data') ?? '');
    if (!dataValida(data)) return fail(400, { erro: 'Informe uma data válida.' });
    if (await db.agendaDiaVistoria.findUnique({ where: { data } })) return fail(400, { erro: 'Esse dia já está na lista.' });
    await db.agendaDiaVistoria.create({ data: { data, aberto: true } });
    await registrarLog({
      event,
      atorTipo: 'funcionario',
      acao: 'agenda_editada',
      descricao: `${rotuloFuncionario(event.locals.funcionario)} abriu o dia ${data} para agendamento de vistoria`,
      entidadeTipo: 'AgendaDiaVistoria',
      entidadeId: data
    });
    return { sucesso: `Dia ${dataBr(data)} aberto para vistoria.` };
  },

  salvarDia: async (event) => {
    const form = await event.request.formData();
    const id = String(form.get('id') ?? '');
    const dia = await db.agendaDiaVistoria.findUnique({ where: { id } });
    if (!dia) return fail(404, { erro: 'Dia não encontrado.' });
    const config = await obterConfig();

    const brutoDia = String(form.get('limitePorHora') ?? '').trim();
    const limiteDia = brutoDia === '' ? null : inteiro(brutoDia);
    if (brutoDia !== '' && limiteDia === null) {
      return fail(400, { erro: 'Limite do dia: número de 0 a 99 (ou vazio para usar o padrão).' });
    }
    const porHorario = {};
    for (const h of config.horarios) {
      const bruto = String(form.get(`limite_${h}`) ?? '').trim();
      if (bruto === '') continue;
      const n = inteiro(bruto);
      if (n === null) return fail(400, { erro: `Limite de ${h}: número de 0 a 99.` });
      if (n !== (limiteDia ?? config.limitePorHora)) porHorario[h] = n;
    }
    const aberto = form.get('aberto') === 'on';
    await db.agendaDiaVistoria.update({
      where: { id },
      data: { aberto, limitePorHora: limiteDia, limitesPorHorario: Object.keys(porHorario).length ? porHorario : null }
    });
    await registrarLog({
      event,
      atorTipo: 'funcionario',
      acao: 'agenda_editada',
      descricao: `${rotuloFuncionario(event.locals.funcionario)} alterou o dia ${dia.data} da agenda de vistoria (${aberto ? 'aberto' : 'fechado'}${limiteDia !== null ? `, ${limiteDia} por hora` : ''}${Object.keys(porHorario).length ? `, limites por horário: ${JSON.stringify(porHorario)}` : ''})`,
      entidadeTipo: 'AgendaDiaVistoria',
      entidadeId: dia.data
    });
    return { sucesso: `Dia ${dataBr(dia.data)} salvo.` };
  }
};
