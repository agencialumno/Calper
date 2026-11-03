// Unidades de EXEMPLO dos Blocos 2 e 3 do Murano para testar a entrega de chaves e a vistoria num ambiente de teste/preview.
// Nomes sintéticos, sem CPF/e-mail/telefone. Idempotente (casa por empreendimento + bloco + número) e só CRIA: nunca altera nem apaga.
//
// Trava de segurança: só roda quando DATABASE_URL_TESTE (ou --url) aponta para um schema chamado calper_test ou calper_preview.
// Uso: node scripts/popular-unidades-exemplo.js            (usa DATABASE_URL_TESTE do .env.test)
//      node scripts/popular-unidades-exemplo.js --aplicar  (sem --aplicar só mostra o que criaria)
import fs from 'node:fs';
import { createRequire } from 'node:module';

const aplicar = process.argv.includes('--aplicar');
let url = process.env.DATABASE_URL_TESTE;
if (!url && fs.existsSync('.env.test')) {
  const linha = fs.readFileSync('.env.test', 'utf8').split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL_TESTE='));
  url = linha?.slice('DATABASE_URL_TESTE='.length).replace(/^"|"$/g, '');
}
const schema = url ? new URL(url).searchParams.get('schema') : null;
if (!url || !['calper_test', 'calper_preview'].includes(schema)) {
  console.error('Recusado: aponte DATABASE_URL_TESTE para um schema calper_test ou calper_preview (nunca produção).');
  process.exit(1);
}

const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient({ datasources: { db: { url } } });

// Bloco 2: entrega de chaves (101..105). Bloco 3: vistoria (101..105, 201 sem comprador = estoque, "não vendida").
const EXEMPLOS = [
  ...[101, 102, 103, 104, 105].map((n) => ({ bloco: '2', numero: String(n), compradores: [{ nome: `COMPRADOR EXEMPLO B2 ${n}`, principal: true }], vistoriaStatus: 'APROVADA' })),
  ...[101, 102, 103, 104, 105].map((n) => ({ bloco: '3', numero: String(n), compradores: [{ nome: `COMPRADOR EXEMPLO B3 ${n}`, principal: true }, ...(n === 105 ? [{ nome: 'CO-COMPRADOR EXEMPLO B3 105', principal: false }] : [])], vistoriaStatus: null })),
  { bloco: '3', numero: '201', compradores: [], vistoriaStatus: 'EM ESTOQUE' }
];

try {
  const murano = await db.empreendimento.findFirst({ where: { nome: { contains: 'Murano', mode: 'insensitive' } } });
  if (!murano) throw new Error('Empreendimento Murano não encontrado neste schema.');
  let criadas = 0;
  for (const ex of EXEMPLOS) {
    const chave = { empreendimentoId_bloco_numero: { empreendimentoId: murano.id, bloco: ex.bloco, numero: ex.numero } };
    if (await db.unidade.findUnique({ where: chave })) continue;
    criadas++;
    console.log(`${aplicar ? 'criando' : 'criaria'} Bloco ${ex.bloco} - nº ${ex.numero}`);
    if (aplicar) await db.unidade.create({ data: { empreendimentoId: murano.id, bloco: ex.bloco, numero: ex.numero, tipologia: '2 QUARTOS', compradores: ex.compradores, vistoriaStatus: ex.vistoriaStatus } });
  }
  console.log(`${criadas} unidade(s) ${aplicar ? 'criada(s)' : 'a criar (simulação; use --aplicar)'} no schema ${schema}.`);
} finally {
  await db.$disconnect();
}
