import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { dataValida, horarioValido, limiteDoSlot, obterConfig, ocupacaoPorSlot } from '$lib/server/agenda.js';
import { registrarLog, rotuloFuncionario } from '$lib/server/log.js';

// Configuração da agenda de entrega de chaves: dias abertos, horários e quantos agendamentos por hora.

const dataBr = (d) => d.split('-').reverse().join('/');

export async function load() {
  const [config, dias] = await Promise.all([obterConfig(), db.agendaDia.findMany({ orderBy: { data: 'asc' } })]);
  const ocupacao = await ocupacaoPorSlot(dias.map((d) => d.data));
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

// número inteiro de 0 a 99, ou null quando vazio/inválido
const inteiro = (v) => {
  const texto = String(v ?? '').trim();
  const n = Number(texto);
  return texto !== '' && Number.isInteger(n) && n >= 0 && n <= 99 ? n : null;
};

export const actions = {
  // padrão geral: limite por hora e lista de horários
  salvarPadrao: async (event) => {
    const form = await event.request.formData();
    const limite = inteiro(form.get('limitePorHora'));
    const horarios = [...new Set(String(form.get('horarios') ?? '').split(/[\s,;]+/).filter(Boolean))].sort();
    if (limite === null) return fail(400, { erro: 'Informe o limite por hora (número de 0 a 99).' });
    if (horarios.length === 0 || !horarios.every(horarioValido)) {
      return fail(400, { erro: 'Horários no formato HH:MM, separados por vírgula (ex: 09:00, 10:00, 13:00).' });
    }
    await db.agendaConfig.upsert({
      where: { id: 'padrao' },
      update: { limitePorHora: limite, horarios },
      create: { id: 'padrao', limitePorHora: limite, horarios }
    });
    await registrarLog({
      event,
      atorTipo: 'funcionario',
      acao: 'agenda_editada',
      descricao: `${rotuloFuncionario(event.locals.funcionario)} alterou o padrão da agenda: ${limite} agendamento(s) por hora; horários ${horarios.join(', ')}`,
      entidadeTipo: 'AgendaConfig',
      entidadeId: 'padrao'
    });
    return { sucesso: 'Padrão da agenda salvo.' };
  },

  adicionarDia: async (event) => {
    const form = await event.request.formData();
    const data = String(form.get('data') ?? '');
    if (!dataValida(data)) return fail(400, { erro: 'Informe uma data válida.' });
    if (await db.agendaDia.findUnique({ where: { data } })) return fail(400, { erro: 'Esse dia já está na lista.' });
    await db.agendaDia.create({ data: { data, aberto: true } });
    await registrarLog({
      event,
      atorTipo: 'funcionario',
      acao: 'agenda_editada',
      descricao: `${rotuloFuncionario(event.locals.funcionario)} abriu o dia ${data} para agendamento`,
      entidadeTipo: 'AgendaDia',
      entidadeId: data
    });
    return { sucesso: `Dia ${dataBr(data)} adicionado.` };
  },

  // um dia: aberto/fechado, limite do dia e limite por horário (campo vazio = herda do dia/padrão)
  salvarDia: async (event) => {
    const form = await event.request.formData();
    const id = String(form.get('id') ?? '');
    const dia = await db.agendaDia.findUnique({ where: { id } });
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
      if (n !== (limiteDia ?? config.limitePorHora)) porHorario[h] = n; // só guarda o que difere do dia
    }
    const aberto = form.get('aberto') === 'on';
    await db.agendaDia.update({
      where: { id },
      data: {
        aberto,
        limitePorHora: limiteDia,
        limitesPorHorario: Object.keys(porHorario).length ? porHorario : null
      }
    });
    await registrarLog({
      event,
      atorTipo: 'funcionario',
      acao: 'agenda_editada',
      descricao: `${rotuloFuncionario(event.locals.funcionario)} alterou o dia ${dia.data} da agenda (${aberto ? 'aberto' : 'fechado'}${limiteDia !== null ? `, ${limiteDia} por hora` : ''}${Object.keys(porHorario).length ? `, limites por horário: ${JSON.stringify(porHorario)}` : ''})`,
      entidadeTipo: 'AgendaDia',
      entidadeId: dia.data
    });
    return { sucesso: `Dia ${dataBr(dia.data)} salvo.` };
  },

  removerDia: async (event) => {
    const form = await event.request.formData();
    const id = String(form.get('id') ?? '');
    const dia = await db.agendaDia.findUnique({ where: { id } });
    if (!dia) return fail(404, { erro: 'Dia não encontrado.' });
    const ocupacao = await ocupacaoPorSlot([dia.data]);
    if ([...ocupacao.values()].some((n) => n > 0)) {
      return fail(400, { erro: 'Esse dia já tem agendamentos: feche o dia em vez de removê-lo.' });
    }
    await db.agendaDia.delete({ where: { id } });
    await registrarLog({
      event,
      atorTipo: 'funcionario',
      acao: 'agenda_editada',
      descricao: `${rotuloFuncionario(event.locals.funcionario)} removeu o dia ${dia.data} da agenda`,
      entidadeTipo: 'AgendaDia',
      entidadeId: dia.data
    });
    return { sucesso: `Dia ${dataBr(dia.data)} removido.` };
  }
};
