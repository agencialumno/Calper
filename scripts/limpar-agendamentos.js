// Apaga SOMENTE os agendamentos (e o que depende deles e não tem sentido sem eles: lista de presença, acompanhantes e
// questionários de encerramento). NÃO toca em unidades, usuários (equipe e investidores), dossiês (histórico),
// procurações da unidade nem nos documentos assinados: o termo/checklist assinado continua guardado e ligado à
// unidade (a coluna agendamentoId do documento vira nula; o PDF fica intacto).
//
// Uso: node --env-file=.env scripts/limpar-agendamentos.js            (só mostra o que seria apagado)
//      node --env-file=.env scripts/limpar-agendamentos.js --aplicar  (apaga)
// Faça um backup antes: node --env-file=.env scripts/backup-banco.js
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const aplicar = process.argv.includes('--aplicar');

async function main() {
  const [agendamentos, presencas, acompanhantes, pesquisas, docs, docsAssinados, comGoogle, procuracoes] = await Promise.all([
    db.agendamento.count(),
    db.presencaEntrega.count(),
    db.acompanhante.count(),
    db.pesquisaSatisfacao.count(),
    db.documentoAssinado.count(),
    db.documentoAssinado.count({ where: { status: 'assinado' } }),
    db.agendamento.count({ where: { googleEventId: { not: null } } }),
    db.procuracaoUnidade.count()
  ]);
  // dataHora guarda o relógio de Brasília como se fosse UTC: "hoje" é o dia de Brasília (UTC-3)
  const inicioHoje = new Date(Date.now() - 3 * 3600 * 1000);
  inicioHoje.setUTCHours(0, 0, 0, 0);
  const [deHojeEmDiante, passados] = await Promise.all([
    db.agendamento.count({ where: { dataHora: { gte: inicioHoje } } }),
    db.agendamento.count({ where: { dataHora: { lt: inicioHoje } } })
  ]);
  const semUnidade = await db.documentoAssinado.count({ where: { unidadeId: null } });

  console.log(aplicar ? 'APAGANDO:' : 'Seria apagado (nada foi gravado):');
  console.log(`  agendamentos: ${agendamentos} (de hoje em diante: ${deHojeEmDiante} | datas passadas: ${passados})`);
  console.log(`  lista de presença: ${presencas} | acompanhantes: ${acompanhantes} | questionários: ${pesquisas}`);
  console.log('Fica intacto:');
  console.log(`  documentos assinados: ${docs} (${docsAssinados} assinados; ficam ligados à unidade) | procurações da unidade: ${procuracoes}`);
  console.log('  unidades, usuários, histórico das unidades, notificações e logs.');
  if (semUnidade > 0) throw new Error(`${semUnidade} documento(s) sem unidade vinculada: rode a migração 20261023120000 antes (o vínculo com a unidade é o que preserva o documento).`);
  if (comGoogle > 0) console.log(`  ATENÇÃO: ${comGoogle} agendamento(s) têm evento no Google Agenda; os eventos NÃO são removidos de lá.`);
  if (!aplicar) return console.log('\nRode de novo com --aplicar para apagar.');

  await db.$transaction(async (tx) => {
    await tx.presencaEntrega.deleteMany();
    await tx.acompanhante.deleteMany();
    await tx.pesquisaSatisfacao.deleteMany();
    await tx.agendamento.deleteMany(); // documentos assinados: FK com ON DELETE SET NULL (ficam, sem agendamento)
  });

  const [restantes, docsDepois, presDepois] = await Promise.all([
    db.agendamento.count(),
    db.documentoAssinado.count(),
    db.presencaEntrega.count()
  ]);
  console.log(`\nDepois: agendamentos ${restantes}, presenças ${presDepois}, documentos assinados ${docsDepois} (antes: ${docs}).`);
  if (docsDepois !== docs) throw new Error('A quantidade de documentos mudou — verifique!');

  const admin = await db.funcionario.findFirst({ where: { perfil: 'admin', ativo: true }, orderBy: { createdAt: 'asc' } });
  await db.logAcesso.create({
    data: {
      atorTipo: 'funcionario',
      funcionarioId: admin?.id ?? null,
      acao: 'agendamentos_limpos',
      descricao: `Limpeza da base de agendamentos (script, a pedido da Calper): ${agendamentos} agendamento(s), ${presencas} presença(s), ${acompanhantes} acompanhante(s) e ${pesquisas} questionário(s) apagados; ${docs} documento(s) assinado(s), unidades, usuários e dossiês preservados. Backup anterior em backups/`,
      entidadeTipo: 'Agendamento'
    }
  });
}

main()
  .catch((e) => {
    console.error('Falhou:', e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
