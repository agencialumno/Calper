// Importa as unidades do Bloco 3 (planilha "Investidores Murano - Bloco 3 - Vistoria de unidades") no Murano.
// Adaptador de colunas: NOME DO EMPREENDIMENTO, BLOCO, UNIDADE, NOME DO CLIENTE, É COMPRADOR PRINCIPAL ?.
// Reaproveita a prévia e a gravação da importação existente (src/lib/server/importarMurano.js): upsert por
// bloco + número, só cria/acrescenta, NUNCA apaga. Só aceita linhas do Bloco 3 (o Bloco 2 não é tocado).
// "NÃO VENDIDA" não é nome de comprador: a unidade entra sem comprador (estoque) e fica fora do agendamento.
//
// A planilha tem dados pessoais e NÃO vai pro git: o caminho vem por parâmetro.
// Uso: node --env-file=.env.test scripts/importar-bloco3.js "C:\caminho\arquivo.xlsx"            (simulação)
//      node --env-file=.env.test scripts/importar-bloco3.js "C:\caminho\arquivo.xlsx" --aplicar  (grava)
// Por segurança só roda em schema calper_test / calper_preview; produção exige --producao (e autorização).
import fs from 'node:fs';
import path from 'node:path';
import readXlsxFile from 'read-excel-file/node';

const caminho = process.argv[2];
const aplicar = process.argv.includes('--aplicar');
const producao = process.argv.includes('--producao');
if (!caminho || caminho.startsWith('--') || !/\.xlsx$/i.test(caminho) || !fs.existsSync(caminho)) {
  console.error('Informe o caminho da planilha .xlsx: node scripts/importar-bloco3.js "<arquivo.xlsx>" [--aplicar]');
  process.exit(1);
}

// o banco é definido pelas variáveis de ambiente; DATABASE_URL_TESTE vale se DATABASE_URL não estiver definida
if (!process.env.DATABASE_URL && process.env.DATABASE_URL_TESTE) process.env.DATABASE_URL = process.env.DATABASE_URL_TESTE;
const schema = (process.env.DATABASE_URL ?? '').match(/[?&]schema=([^&]+)/)?.[1] ?? 'public';
if (!['calper_test', 'calper_preview'].includes(schema) && !producao) {
  console.error(`Recusado: o schema é "${schema}". Este script só roda em calper_test/calper_preview (produção exige --producao e autorização).`);
  process.exit(1);
}

const { aplicarAtualizar, montarPrevia } = await import('../src/lib/server/importarMurano.js');
const { db } = await import('../src/lib/server/db.js');

const semAcento = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').toUpperCase().trim();
const limpar = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
const CAB = { BLOCO: 'bloco', UNIDADE: 'numero', 'NOME DO CLIENTE': 'nome', 'E COMPRADOR PRINCIPAL ?': 'principal', 'E COMPRADOR PRINCIPAL?': 'principal' };

function lerBloco3(abas) {
  const unidades = new Map();
  const erros = [];
  let linhas = 0;
  for (const { sheet, data } of abas) {
    const cab = (data[0] ?? []).map((c) => CAB[semAcento(c)] ?? null);
    if (!cab.includes('bloco') || !cab.includes('numero') || !cab.includes('nome')) continue;
    data.slice(1).forEach((linha, i) => {
      const n = i + 2;
      const campo = (c) => linha[cab.indexOf(c)];
      if (linha.every((c) => c === null || c === undefined || limpar(c) === '')) return;
      linhas++;
      const bloco = limpar(campo('bloco'));
      const numero = limpar(campo('numero'));
      if (!bloco || !numero) return erros.push(`${sheet}!${n}: bloco ou unidade em branco`);
      if (bloco !== '3') return erros.push(`${sheet}!${n}: bloco "${bloco}" (só o Bloco 3 é aceito)`);
      const u = unidades.get(numero) ?? { bloco, numero, compradores: [], naoVendida: false };
      const nome = limpar(campo('nome'));
      if (!nome || semAcento(nome) === 'NAO VENDIDA') u.naoVendida = true;
      else if (!u.compradores.some((c) => semAcento(c.nome) === semAcento(nome))) {
        u.compradores.push({ nome, principal: /^s/i.test(limpar(campo('principal'))) });
      }
      unidades.set(numero, u);
    });
  }
  const lista = [...unidades.values()];
  for (const u of lista) {
    if (u.compradores.length > 0 && !u.compradores.some((c) => c.principal)) u.compradores[0].principal = true;
    // unidade "NÃO VENDIDA" não tem comprador; se a mesma unidade tiver nome de verdade, vale o nome
    if (u.compradores.length === 0) u.naoVendida = true;
  }
  return { unidades: lista, erros, linhas };
}

async function main() {
  console.log(`Banco: schema ${schema}${aplicar ? '' : ' (simulação: nada será gravado)'}`);
  const leitura = lerBloco3(await readXlsxFile(fs.readFileSync(caminho)));
  if (leitura.erros.length) {
    leitura.erros.slice(0, 15).forEach((e) => console.log('  ERRO', e));
    throw new Error('A planilha tem linhas fora do padrão; nada foi feito.');
  }
  const { unidades } = leitura;
  const vendidas = unidades.filter((u) => !u.naoVendida);
  const naoVendidas = unidades.filter((u) => u.naoVendida);
  const compradores = vendidas.flatMap((u) => u.compradores);
  const porQtd = {};
  for (const u of vendidas) porQtd[u.compradores.length] = (porQtd[u.compradores.length] ?? 0) + 1;

  console.log(`Planilha: ${path.basename(caminho)} — ${leitura.linhas} linha(s)`);
  console.log(`Unidades do Bloco 3: ${unidades.length} (vendidas ${vendidas.length}, não vendidas ${naoVendidas.length})`);
  console.log(`Compradores: ${compradores.length} (principais ${compradores.filter((c) => c.principal).length}, secundários ${compradores.filter((c) => !c.principal).length})`);
  console.log('Unidades por quantidade de compradores:', porQtd);
  console.log(`Não vendidas (sem comprador, fora do agendamento): ${naoVendidas.map((u) => u.numero).join(', ') || '—'}`);

  const previa = await montarPrevia(unidades.map(({ naoVendida, ...u }) => u));
  console.log('Prévia (banco atual):', previa.resumo);
  if (previa.novas.length) console.log(`Unidades a criar: ${previa.novas.length}`);
  console.log(`Unidades do Bloco 2 e outras no banco: ${previa.ausentes.length} (ficam como estão)`);

  if (!aplicar) return console.log('\nNada foi gravado. Rode de novo com --aplicar para gravar.');

  const admin = await db.funcionario.findFirst({ where: { perfil: 'admin', ativo: true }, orderBy: { createdAt: 'asc' } });
  if (!admin) throw new Error('Nenhum admin ativo encontrado para registrar a importação.');
  const nomeArquivo = path.basename(caminho);
  const resultado = await aplicarAtualizar(unidades.map(({ naoVendida, ...u }) => u), { funcionarioId: admin.id, nomeArquivo });
  await db.importacaoLote.create({
    data: { nomeArquivo, totalLinhas: leitura.linhas, unidadesCriadas: resultado.criadas, investidoresCriados: 0, erros: { modo: 'atualizar', origem: 'script-bloco3', atualizadas: resultado.atualizadas }, criadoPorId: admin.id }
  });
  console.log('\nAplicado:', resultado);
}

main()
  .catch((e) => {
    console.error('Falhou:', e.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
