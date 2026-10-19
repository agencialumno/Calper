import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { ROTULO_VINCULO, SLUG_ENTREGA_CHAVES } from '$lib/server/entregaChaves.js';
import { quartosDaUnidade } from '$lib/server/documentos.js';

// CSV simples (texto puro, sem formatação) com tudo de relevante das entregas de chaves:
// unidade, comprador, quem agendou, procuração, data/hora, documentos e presença.
// ';' como separador e BOM, pra abrir direto no Excel em português.

const celula = (v) => `"${String(v ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
const sn = (b) => (b ? 'sim' : 'não');
const dataHoraBr = (d) =>
  d ? d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }) : '';

export async function GET({ locals }) {
  if (!locals.funcionario) throw redirect(303, '/admin/login');

  const agendamentos = await db.agendamento.findMany({
    where: { tipoEvento: { slug: SLUG_ENTREGA_CHAVES } },
    orderBy: [{ dataHora: 'asc' }, { createdAt: 'asc' }],
    // sem os arquivos (procuração/documento em base64): só o que entra no CSV
    select: {
      status: true,
      createdAt: true,
      dataHora: true,
      nomeCompareceu: true,
      cpfCompareceu: true,
      telefoneCompareceu: true,
      emailCompareceu: true,
      ehProprietario: true,
      proprietarioNome: true,
      procuracaoCpf: true,
      retiranteNome: true,
      retiranteCpf: true,
      retiranteEmail: true,
      unidade: {
        select: { bloco: true, numero: true, tipologia: true, quartos: true, grupo: true, statusQuitacao: true, compradores: true }
      },
      documentosAssinados: { select: { tipo: true, status: true, assinadoEm: true } },
      presencas: { orderBy: { createdAt: 'asc' }, select: { nome: true, vinculo: true, createdAt: true } }
    }
  });

  const cabecalho = [
    'Bloco',
    'Unidade',
    'Quartos',
    'Grupo',
    'Pagamento',
    'Compradores cadastrados',
    'Investidor que agendou',
    'CPF do investidor',
    'Telefone',
    'E-mail',
    'É o proprietário',
    'Nome do proprietário',
    'Procuração anexada',
    'Data agendada',
    'Hora agendada',
    'Status do agendamento',
    'Quem retira as chaves',
    'CPF de quem retira',
    'E-mail de quem retira',
    'Termo',
    'Termo assinado em',
    'Checklist',
    'Checklist assinado em',
    'Entrega concluída',
    'Presentes',
    'Agendado em'
  ];

  const pagamento = { quitada: 'quitada', a_vencer: 'a vencer' };
  const linhas = agendamentos.map((a) => {
    const doc = (tipo) => a.documentosAssinados.find((d) => d.tipo === tipo);
    const termo = doc('termo');
    const checklist = doc('checklist');
    // dataHora guarda o relógio escolhido como UTC (ver agenda.js)
    const iso = a.dataHora.toISOString();
    return [
      a.unidade.bloco,
      a.unidade.numero,
      quartosDaUnidade(a.unidade) ?? '',
      a.unidade.grupo ?? '',
      pagamento[a.unidade.statusQuitacao] ?? 'não informado',
      (Array.isArray(a.unidade.compradores) ? a.unidade.compradores : []).map((c) => c.nome).join(' | '),
      a.nomeCompareceu,
      a.cpfCompareceu,
      a.telefoneCompareceu,
      a.emailCompareceu,
      a.ehProprietario === null ? '' : sn(a.ehProprietario),
      a.proprietarioNome,
      sn(Boolean(a.procuracaoCpf)),
      iso.slice(0, 10).split('-').reverse().join('/'),
      iso.slice(11, 16),
      a.status,
      a.retiranteNome,
      a.retiranteCpf,
      a.retiranteEmail,
      termo?.status ?? 'não enviado',
      dataHoraBr(termo?.assinadoEm),
      checklist?.status ?? 'não enviado',
      dataHoraBr(checklist?.assinadoEm),
      sn(a.status === 'realizado'),
      a.presencas.map((p) => `${p.nome} (${ROTULO_VINCULO[p.vinculo] ?? p.vinculo}, ${dataHoraBr(p.createdAt)})`).join(' | '),
      dataHoraBr(a.createdAt)
    ];
  });

  const hoje = new Date().toISOString().slice(0, 10);
  return new Response('﻿' + [cabecalho, ...linhas].map((l) => l.map(celula).join(';')).join('\r\n'), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="entregas-de-chaves-${hoje}.csv"`
    }
  });
}
