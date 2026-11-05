import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { SLUG_VISTORIA } from '$lib/servicos.js';
import { TIPO_DOCUMENTO_VISTORIA, presentesDoAgendamento, rotuloDaVistoria } from '$lib/vistoria.js';

// CSV das vistorias (Bloco 3): quem agendou, quem compareceu, resultado, reparos e termo. ';' + BOM para abrir no Excel.
const celula = (v) => `"${String(v ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
const dataHoraBr = (d) => (d ? d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }) : '');
const VINCULO = { comprador_principal: 'comprador principal', comprador: 'comprador', procurador: 'procurador' };

export async function GET({ locals }) {
  if (!locals.funcionario) throw redirect(303, '/admin/login');
  const agendamentos = await db.agendamento.findMany({
    where: { tipoEvento: { slug: SLUG_VISTORIA } },
    orderBy: [{ dataHora: 'asc' }, { createdAt: 'asc' }],
    // sem os arquivos em base64: só o que entra no CSV
    select: {
      status: true, origem: true, checkinEm: true, canceladoEm: true, motivoCancelamento: true, createdAt: true, dataHora: true, vistoriaNumero: true,
      nomeCompareceu: true, telefoneCompareceu: true, emailCompareceu: true, ehProprietario: true, proprietarioNome: true,
      vistoriaPresentes: true, vistoriaResultado: true, vistoriaReparos: true, vistoriaTelefoneRetorno: true, vistoriaConcluidaEm: true,
      observacoesAtendimento: true,
      unidade: { select: { bloco: true, numero: true, compradores: true } },
      documentosAssinados: { where: { tipo: TIPO_DOCUMENTO_VISTORIA }, select: { status: true, assinadoEm: true } }
    }
  });
  const cabecalho = [
    'Bloco', 'Unidade', 'Nº da vistoria', 'Compradores cadastrados', 'Quem agendou', 'Telefone', 'E-mail', 'É o proprietário',
    'Data agendada', 'Hora agendada', 'Status do agendamento', 'Resultado da vistoria', 'Reparos', 'Telefone para contato',
    'Quem compareceu', 'Termo de recebimento', 'Termo assinado em', 'Concluída em', 'Observações do atendimento', 'Agendado em', 'Origem',
    'Desmarcado em', 'Motivo do cancelamento'
  ];
  const linhas = agendamentos.map((a) => {
    const termo = a.documentosAssinados[0];
    const iso = a.dataHora.toISOString();
    return [
      a.unidade.bloco, a.unidade.numero, a.vistoriaNumero,
      (Array.isArray(a.unidade.compradores) ? a.unidade.compradores : []).map((c) => c.nome).join(' | '),
      a.nomeCompareceu, a.telefoneCompareceu, a.emailCompareceu, a.ehProprietario === null ? '' : a.ehProprietario ? 'sim' : 'não',
      iso.slice(0, 10).split('-').reverse().join('/'), iso.slice(11, 16), a.status, rotuloDaVistoria(a), a.vistoriaReparos ?? '', a.vistoriaTelefoneRetorno ?? '',
      presentesDoAgendamento(a).map((p) => `${p.nome} (${VINCULO[p.vinculo] ?? p.vinculo})`).join(' | '),
      termo?.status ?? (a.vistoriaResultado === 'nao_aceita' ? 'sem documento' : 'não enviado'), dataHoraBr(termo?.assinadoEm), dataHoraBr(a.vistoriaConcluidaEm),
      a.observacoesAtendimento ?? '', dataHoraBr(a.createdAt), a.origem === 'atendimento_direto' ? 'Atendimento direto' : 'Agendamento',
      dataHoraBr(a.canceladoEm), a.motivoCancelamento ?? ''
    ];
  });
  const hoje = new Date().toISOString().slice(0, 10);
  return new Response('﻿' + [cabecalho, ...linhas].map((l) => l.map(celula).join(';')).join('\r\n'), {
    headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="vistorias-${hoje}.csv"` }
  });
}
