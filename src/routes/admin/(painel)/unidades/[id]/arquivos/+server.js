import { error, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db.js';
import { criarZip } from '$lib/server/zip.js';
import { registrarLog, rotuloFuncionario } from '$lib/server/log.js';

const EXTENSAO = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic'
};
const NOME_DOC = { termo: 'termo-entrega-chaves-assinado', checklist: 'checklist-assinado' };

/** "data:<tipo>;base64,<dados>" → { conteudo, extensao } (ou null se não for um data URL). */
function lerDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return null;
  const fimTipo = dataUrl.indexOf(';');
  const virgula = dataUrl.indexOf(',');
  if (fimTipo < 0 || virgula < 0) return null;
  const tipo = dataUrl.slice(5, fimTipo);
  return { conteudo: Buffer.from(dataUrl.slice(virgula + 1), 'base64'), extensao: EXTENSAO[tipo] ?? 'bin' };
}

const seguro = (s) =>
  String(s ?? 'sem-nome')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'sem-nome';
const csvCelula = (v) => `"${String(v ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;

// Backup da unidade: .zip com todos os arquivos ligados a ela (documentos de identificação, procurações, termo e
// checklist assinados) e um índice com a origem de cada um. Os arquivos moram em base64 no banco.
export async function GET(event) {
  const { params, locals } = event;
  if (!locals.funcionario) throw redirect(303, '/admin/login');

  const unidade = await db.unidade.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      bloco: true,
      numero: true,
      compradores: true,
      procuracoes: { orderBy: { createdAt: 'asc' } },
      // documentos assinados cujo agendamento foi apagado (ficam ligados à unidade)
      documentosAssinados: { where: { agendamentoId: null, status: 'assinado' }, select: { id: true, tipo: true, pdfBase64: true, assinadoEm: true } },
      agendamentos: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          status: true,
          dataHora: true,
          nomeCompareceu: true,
          cpfCompareceu: true,
          documentoBase64: true,
          procuracaoBase64: true,
          acompanhantes: { select: { nome: true, documentoBase64: true } },
          documentosAssinados: { select: { tipo: true, status: true, pdfBase64: true, assinadoEm: true } }
        }
      }
    }
  });
  if (!unidade) throw error(404, 'Unidade não encontrada');

  const arquivos = [];
  const indice = [['Arquivo no zip', 'Tipo', 'Descrição', 'Data']];
  const vistos = new Set();
  const adicionar = (pasta, nome, dataUrl, tipo, descricao, data) => {
    const arq = lerDataUrl(dataUrl);
    if (!arq || arq.conteudo.length === 0) return;
    // o mesmo arquivo salvo em mais de um lugar (ex.: procuração no agendamento e na unidade) entra uma vez só
    const chave = `${arq.conteudo.length}:${arq.conteudo.subarray(0, 64).toString('hex')}:${arq.conteudo.subarray(-64).toString('hex')}`;
    if (vistos.has(chave)) return;
    vistos.add(chave);
    const caminho = `${pasta}/${nome}.${arq.extensao}`;
    arquivos.push({ nome: caminho, conteudo: arq.conteudo });
    indice.push([caminho, tipo, descricao, data ? data.toISOString().slice(0, 10) : '']);
  };

  unidade.procuracoes.forEach((p, i) =>
    adicionar('procuracoes', `${String(i + 1).padStart(2, '0')}-${seguro(p.nome)}`, p.arquivoBase64, 'procuração', `Procurador: ${p.nome} (CPF ${p.cpf}), origem: ${p.origem}`, p.createdAt)
  );
  for (const d of unidade.documentosAssinados) {
    if (d.pdfBase64) adicionar('documentos-assinados', `${NOME_DOC[d.tipo] ?? d.tipo}-${d.id.slice(-8)}`, d.pdfBase64, `${d.tipo} assinado`, 'Documento de uma entrega cujo agendamento foi apagado', d.assinadoEm);
  }
  for (const a of unidade.agendamentos) {
    const rotulo = `${a.dataHora.toISOString().slice(0, 10)}-${seguro(a.nomeCompareceu)}`;
    for (const d of a.documentosAssinados) {
      if (d.status === 'assinado' && d.pdfBase64) {
        adicionar('documentos-assinados', `${NOME_DOC[d.tipo] ?? d.tipo}-${rotulo}`, d.pdfBase64, `${d.tipo} assinado`, `Entrega de ${a.nomeCompareceu ?? '—'}`, d.assinadoEm);
      }
    }
    adicionar('identificacao', `documento-${rotulo}`, a.documentoBase64, 'documento de identificação', `Enviado por ${a.nomeCompareceu ?? '—'}`, a.dataHora);
    adicionar('procuracoes', `procuracao-agendamento-${rotulo}`, a.procuracaoBase64, 'procuração', `Anexada no agendamento de ${a.nomeCompareceu ?? '—'}`, a.dataHora);
    a.acompanhantes.forEach((c, i) =>
      adicionar('identificacao', `acompanhante-${i + 1}-${seguro(c.nome)}`, c.documentoBase64, 'documento de identificação', `Acompanhante: ${c.nome}`, a.dataHora)
    );
  }

  const compradores = (Array.isArray(unidade.compradores) ? unidade.compradores : []).map((c) => c.nome).join(' | ');
  const leiame = [
    `Unidade ${unidade.numero} — Bloco ${unidade.bloco}`,
    `Compradores: ${compradores || '—'}`,
    `Gerado em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} por ${rotuloFuncionario(locals.funcionario)}`,
    '',
    'Pastas: identificacao, procuracoes, documentos-assinados. O arquivo indice.csv lista cada arquivo e a origem dele.',
    'Fotos de vistoria não entram: o sistema ainda não guarda fotos por unidade.',
    'ATENÇÃO: contém dados pessoais (CPF, documentos). Guarde em local seguro e apague cópias que não forem necessárias.'
  ].join('\r\n');
  const csv = '﻿' + indice.map((l) => l.map(csvCelula).join(';')).join('\r\n');
  arquivos.push({ nome: 'LEIA-ME.txt', conteudo: Buffer.from(leiame, 'utf8') });
  arquivos.push({ nome: 'indice.csv', conteudo: Buffer.from(csv, 'utf8') });

  await registrarLog({
    event,
    atorTipo: 'funcionario',
    acao: 'arquivos_unidade_baixados',
    descricao: `${rotuloFuncionario(locals.funcionario)} baixou o backup de arquivos da Unidade ${unidade.numero}, Bloco ${unidade.bloco} (${arquivos.length - 2} arquivo(s))`,
    entidadeTipo: 'Unidade',
    entidadeId: unidade.id
  });

  return new Response(criarZip(arquivos), {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="unidade-bloco-${seguro(unidade.bloco)}-${seguro(unidade.numero)}-arquivos.zip"`
    }
  });
}
