// Atualiza a base de unidades do Murano a partir de uma planilha .xlsx (modo "atualizar": casa por Bloco+Unidade,
// só altera o que mudou, cria as unidades novas e NUNCA apaga nada — dossiês, agendamentos, documentos e compradores
// ficam como estão; célula em branco na planilha não apaga o que já existe). É o mesmo código da tela
// /admin/unidades/importar.
//
// A planilha tem dados pessoais/financeiros e NÃO vai pro git: o caminho é sempre passado por parâmetro.
// Uso: node --env-file=.env scripts/importar-planilha.js "C:\caminho\MURANO_CONSOLIDADO.xlsx"            (só prévia)
//      node --env-file=.env scripts/importar-planilha.js "C:\caminho\MURANO_CONSOLIDADO.xlsx" --aplicar  (grava)
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { aplicarAtualizar, lerPlanilha, montarPrevia } from '../src/lib/server/importarMurano.js';

const caminho = process.argv[2];
const aplicar = process.argv.includes('--aplicar');
if (!caminho || caminho.startsWith('--')) {
  console.error('Informe o caminho da planilha: node --env-file=.env scripts/importar-planilha.js "<arquivo.xlsx>" [--aplicar]');
  process.exit(1);
}
if (!/\.xlsx$/i.test(caminho) || !fs.existsSync(caminho)) {
  console.error(`Arquivo não encontrado ou não é .xlsx: ${caminho}`);
  process.exit(1);
}

const db = new PrismaClient();

async function main() {
  const leitura = await lerPlanilha(fs.readFileSync(caminho));
  console.log(`Planilha: ${path.basename(caminho)} — ${leitura.unidades.length} unidade(s), ${leitura.erros.length} erro(s), ${leitura.avisos.length} aviso(s)`);
  leitura.erros.slice(0, 10).forEach((e) => console.log('  ERRO', e));
  leitura.avisos.slice(0, 10).forEach((a) => console.log('  aviso:', a));

  const previa = await montarPrevia(leitura.unidades);
  console.log('Prévia:', previa.resumo);
  const porCampo = {};
  for (const u of previa.alteradas) for (const d of u.diferencas) porCampo[d.campo] = (porCampo[d.campo] ?? 0) + 1;
  console.log('Campos a atualizar (quantas unidades):', porCampo);
  if (previa.novas.length) console.log('Unidades novas:', previa.novas.map((u) => `${u.bloco}/${u.numero}`).join(', '));
  if (previa.ausentes.length) console.log('Já cadastradas e fora da planilha (ficam como estão):', previa.ausentes.map((u) => `${u.bloco}/${u.numero}`).join(', '));
  if (previa.afetadas.length) console.log(`Unidades com agendamento/documento em andamento que mudam: ${previa.afetadas.length}`);

  if (!aplicar) {
    console.log('\nNada foi gravado. Rode de novo com --aplicar para gravar.');
    return;
  }

  const admin = await db.funcionario.findFirst({ where: { perfil: 'admin', ativo: true }, orderBy: { createdAt: 'asc' } });
  if (!admin) throw new Error('Nenhum admin ativo encontrado para registrar a importação.');
  const nomeArquivo = path.basename(caminho);
  const resultado = await aplicarAtualizar(leitura.unidades, { funcionarioId: admin.id, nomeArquivo });
  await db.importacaoLote.create({
    data: {
      nomeArquivo,
      totalLinhas: leitura.unidades.length,
      unidadesCriadas: resultado.criadas,
      investidoresCriados: 0,
      erros: { modo: 'atualizar', atualizadas: resultado.atualizadas, origem: 'script' },
      criadoPorId: admin.id
    }
  });
  await db.logAcesso.create({
    data: {
      atorTipo: 'funcionario',
      funcionarioId: admin.id,
      acao: 'base_atualizada',
      descricao: `Base de entrega de chaves atualizada por linha de comando com "${nomeArquivo}": ${resultado.criadas} criada(s), ${resultado.atualizadas} atualizada(s), ${resultado.iguais} sem mudança`,
      entidadeTipo: 'ImportacaoLote'
    }
  });
  console.log('\nAplicado:', resultado);
}

main()
  .catch((e) => {
    console.error('Falhou:', e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
