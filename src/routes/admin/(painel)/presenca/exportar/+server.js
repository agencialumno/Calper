import { redirect } from '@sveltejs/kit';
import { buscarPresencas, filtrosDePresenca } from '$lib/server/presenca.js';
import { ROTULO_VINCULO } from '$lib/server/entregaChaves.js';

const celula = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

// CSV da lista de presença (mesmos filtros da tela), pronto pra abrir no Excel (BOM + ';').
export async function GET({ url, locals }) {
  if (!locals.funcionario) throw redirect(303, '/admin/login');

  const { where } = filtrosDePresenca(url.searchParams);
  const presencas = await buscarPresencas(where);

  const fmt = (d) =>
    d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
  const linhas = [
    ['Data/hora', 'Nome', 'Vínculo', 'CPF', 'Bloco', 'Unidade', 'Observações do atendimento'],
    ...presencas.map((p) => [
      fmt(p.createdAt),
      p.nome,
      ROTULO_VINCULO[p.vinculo] ?? p.vinculo,
      p.cpf ?? '',
      p.unidade.bloco,
      p.unidade.numero,
      p.agendamento?.observacoesAtendimento ?? ''
    ])
  ];

  return new Response('﻿' + linhas.map((l) => l.map(celula).join(';')).join('\r\n'), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="lista-presenca-entrega-chaves.csv"'
    }
  });
}
