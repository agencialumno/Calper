// CSV simples pra abrir direto no Excel em português: ';' como separador, BOM e quebras CRLF.
const celula = (v) => `"${String(v ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;

export const sn = (b) => (b ? 'sim' : 'não');

/** Data/hora de um instante real (fuso de Brasília). */
export const dataHoraBr = (d) =>
  d ? d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }) : '';

/** Data e hora de um agendamento: o relógio escolhido é gravado como UTC (ver agenda.js). */
export function dataHoraAgendada(d) {
  const iso = d.toISOString();
  return { data: iso.slice(0, 10).split('-').reverse().join('/'), hora: iso.slice(11, 16) };
}

export function respostaCsv(nomeArquivo, linhas) {
  return new Response('﻿' + linhas.map((l) => l.map(celula).join(';')).join('\r\n'), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${nomeArquivo}"`
    }
  });
}
