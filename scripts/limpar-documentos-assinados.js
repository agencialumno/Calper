// Apaga os termos/checklists assinados (tabela DocumentoAssinado) — usado para tirar da base os PDFs dos TESTES.
// O PDF assinado mora na própria linha (coluna pdfBase64, em base64), então apagar a linha apaga o arquivo; não há
// storage externo. NÃO toca em unidades, investidores, procurações, agendamentos, histórico, presenças nem contas.
//
// Uso: node --env-file=.env scripts/limpar-documentos-assinados.js                         (simulação: só lista)
//      node --env-file=.env scripts/limpar-documentos-assinados.js --aplicar --lista=<código>  (apaga)
// O código da lista aparece no fim da simulação: ele garante que o que será apagado é EXATAMENTE a lista que foi
// confirmada (se algo mudou no meio, o script recusa). Faça um backup antes: node --env-file=.env scripts/backup-banco.js
//
// ATENÇÃO: apagar aqui NÃO apaga no DocuSign. Os envelopes continuam na conta do DocuSign (veja a lista de envelopes).
import { createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const aplicar = process.argv.includes('--aplicar');
const listaInformada = process.argv.find((a) => a.startsWith('--lista='))?.slice('--lista='.length) ?? null;

const brt = (d) => (d ? d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }) : '—');
const kb = (s) => (s ? `${Math.round((s.length * 3) / 4 / 1024)} KB` : 'sem arquivo');

/** Contagens das demais tabelas, para provar no fim que nada além dos documentos mudou. */
async function contagens() {
  const [unidades, investidores, procuracoes, agendamentos, historico, presencas, acompanhantes, pesquisas, funcionarios, notificacoes, templates] =
    await Promise.all([
      db.unidade.count(),
      db.investidor.count(),
      db.procuracaoUnidade.count(),
      db.agendamento.count(),
      db.historicoUnidade.count(),
      db.presencaEntrega.count(),
      db.acompanhante.count(),
      db.pesquisaSatisfacao.count(),
      db.funcionario.count(),
      db.notificacao.count(),
      db.documentoTemplate.count()
    ]);
  return { unidades, investidores, procuracoes, agendamentos, historico, presencas, acompanhantes, pesquisas, funcionarios, notificacoes, templates };
}

async function main() {
  // sem o pdfBase64 na consulta: só o tamanho (length) interessa na simulação
  const docs = await db.documentoAssinado.findMany({
    orderBy: [{ unidadeId: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true, tipo: true, status: true, assinadoEm: true, createdAt: true, docusignEnvelopeId: true, agendamentoId: true, unidadeId: true, pdfBase64: true,
      unidade: { select: { bloco: true, numero: true, compradores: true } },
      agendamento: { select: { retiranteNome: true, nomeCompareceu: true, conjugeNome: true } }
    }
  });

  console.log(aplicar ? 'APAGANDO' : 'SIMULAÇÃO (nada será apagado)', `— ${docs.length} documento(s) assinado(s):\n`);
  for (const d of docs) {
    const comprador = (Array.isArray(d.unidade?.compradores) ? d.unidade.compradores : []).find((c) => c.principal)?.nome ?? '—';
    const quem = d.agendamento
      ? [d.agendamento.retiranteNome ?? d.agendamento.nomeCompareceu, d.agendamento.conjugeNome].filter(Boolean).join(' e ')
      : `não registrado (agendamento apagado) — comprador principal da unidade: ${comprador}`;
    console.log(
      `Bloco ${d.unidade?.bloco ?? '?'} nº ${d.unidade?.numero ?? '?'} | ${d.tipo} (${d.status}) | assinado em ${brt(d.assinadoEm)} | quem assinou: ${quem} | guardado: banco, coluna pdfBase64 (${kb(d.pdfBase64)}) | envelope DocuSign: ${d.docusignEnvelopeId}`
    );
  }

  const envelopes = [...new Set(docs.map((d) => d.docusignEnvelopeId))];
  const semArquivo = docs.filter((d) => !d.pdfBase64).length;
  const codigo = createHash('sha256').update(docs.map((d) => d.id).sort().join(',')).digest('hex').slice(0, 12);
  console.log(`\nResumo: ${docs.length} documento(s) em ${new Set(docs.map((d) => d.unidadeId)).size} unidade(s); ${docs.filter((d) => d.tipo === 'termo').length} termo(s) e ${docs.filter((d) => d.tipo === 'checklist').length} checklist(s); ${semArquivo} sem arquivo.`);
  console.log(`Armazenamento: tudo no banco (base64); nenhum arquivo em storage externo.`);
  console.log(`DocuSign: ${envelopes.length} envelope(s) distinto(s) — ${docs.length} de ${docs.length} documento(s) têm envelope. Apagar aqui NÃO apaga no DocuSign.`);
  console.log(`Código da lista: ${codigo}`);

  const antes = await contagens();
  if (!aplicar) {
    console.log('\nContagens das demais tabelas (não serão alteradas):', JSON.stringify(antes));
    console.log(`\nPara apagar: node --env-file=.env scripts/limpar-documentos-assinados.js --aplicar --lista=${codigo}`);
    return;
  }
  if (listaInformada !== codigo) {
    throw new Error(`Recusado: --lista=${listaInformada ?? '(ausente)'} não confere com a lista atual (${codigo}). Rode a simulação de novo e confirme a lista.`);
  }

  const ids = docs.map((d) => d.id);
  // documentos ainda não assinados: o envelope pode continuar aberto no DocuSign (apagar aqui não o anula)
  const abertos = docs
    .filter((d) => d.status !== 'assinado')
    .map((d) => `Unidade ${d.unidade?.numero ?? '?'}, Bloco ${d.unidade?.bloco ?? '?'} — ${d.tipo} (${d.status}): ${d.docusignEnvelopeId}`);
  const apagados = await db.$transaction(async (tx) => {
    const r = await tx.documentoAssinado.deleteMany({ where: { id: { in: ids } } });
    if (r.count !== ids.length) throw new Error(`Esperava apagar ${ids.length}, apagaria ${r.count}: transação desfeita.`);
    return r.count;
  });

  const depois = await contagens();
  const restantes = await db.documentoAssinado.count();
  console.log(`\nApagados: ${apagados}. DocumentoAssinado agora: ${restantes}.`);
  const mudou = Object.keys(antes).filter((k) => antes[k] !== depois[k]);
  console.log('Demais contagens (antes → depois):', JSON.stringify(depois), mudou.length ? `MUDARAM: ${mudou.join(', ')}` : '— nenhuma mudou.');
  if (restantes !== 0 || mudou.length) throw new Error('Conferência final falhou — verifique!');

  const admin = await db.funcionario.findFirst({ where: { perfil: 'admin', ativo: true }, orderBy: { createdAt: 'asc' } });
  await db.logAcesso.create({
    data: {
      atorTipo: 'funcionario',
      funcionarioId: admin?.id ?? null,
      acao: 'documentos_assinados_apagados',
      descricao: `Limpeza dos PDFs assinados de teste (script, a pedido da Calper): ${apagados} documento(s) assinado(s) apagado(s) de ${new Set(docs.map((d) => d.unidadeId)).size} unidade(s) (lista ${codigo}); unidades, investidores, procurações, agendamentos e contas preservados. Os envelopes continuam no DocuSign. ${abertos.length ? `Envelopes NÃO assinados que continuam ABERTOS no DocuSign de produção (não foram anulados): ${abertos.join('; ')}. ` : ''}Backup anterior em backups/`,
      entidadeTipo: 'DocumentoAssinado'
    }
  });
  console.log('Log de auditoria gravado.');
}

main()
  .catch((e) => {
    console.error('Falhou:', e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
