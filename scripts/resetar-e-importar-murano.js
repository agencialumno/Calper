// Apaga os dados cadastrados (investidores, unidades, agendamentos, empreendimentos...) e importa
// a base real do Murano a partir de scripts/murano-dados.json.
// Reexecutável: cada execução faz um reset limpo e reimporta (não duplica nada).
// NÃO apaga: Funcionario, SessaoFuncionario, TipoEvento, ImportacaoLote, LogAcesso.
// Uso: bun scripts/resetar-e-importar-murano.js
//
// ATENÇÃO — scripts/murano-dados.json NÃO está no git (está no .gitignore): ele traz nomes de
// clientes, ou seja, dados pessoais. Quem for rodar este script precisa ter o arquivo localmente:
//   1. peça uma cópia a quem já tem, ou
//   2. gere de novo a partir da planilha MURANO_BL2_base_entrega_chaves.xlsx (também fora do git,
//      guardada em docs-referencia/): agrupe as linhas por (BLOCO, UNIDADE) num JSON assim:
//      [{ "bloco": "2", "numero": "101", "tipologia": "3 QUARTOS", "grupo": "A",
//         "statusQuitacao": "A VENCER", "compradores": [{ "nome": "FULANO", "principal": true }] }]
//      (compradores: [] quando o nome na planilha é "N/A"; "grupo" e "statusQuitacao" ficam null
//      nessas unidades). Sem o arquivo o script falha ANTES de apagar qualquer dado.
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { CHECKLIST_PADRAO, TERMO_PADRAO, TIPO_CHECKLIST, TIPO_TERMO } from '../src/lib/documentosPadrao.js';

const db = new PrismaClient();

const dados = JSON.parse(readFileSync(new URL('./murano-dados.json', import.meta.url), 'utf-8'));

const STATUS_QUITACAO = { QUITADA: 'quitada', 'A VENCER': 'a_vencer' };

async function main() {
  console.log('Apagando dados existentes...');
  // ordem respeita as chaves estrangeiras (filhos antes dos pais)
  await db.$transaction([
    db.presencaEntrega.deleteMany(),
    db.procuracaoUnidade.deleteMany(),
    db.documentoAssinado.deleteMany(),
    db.pesquisaSatisfacao.deleteMany(),
    db.acompanhante.deleteMany(),
    db.emailEnviado.deleteMany(),
    db.notificacao.deleteMany({ where: { destinatarioTipo: 'investidor' } }),
    db.agendamento.deleteMany(),
    db.atualizacaoEstagio.deleteMany(),
    db.historicoUnidade.deleteMany(),
    db.unidadeInvestidor.deleteMany(),
    db.sessao.deleteMany(),
    db.unidade.deleteMany(),
    db.investidor.deleteMany(),
    db.documentoTemplate.deleteMany(), // referencia Empreendimento; recriado com o texto padrão no primeiro uso
    db.empreendimento.deleteMany()
  ]);

  const empreendimento = await db.empreendimento.create({
    data: { nome: 'Murano', estagioAtual: 'Entrega das Chaves', etapa: 'entrega_chaves' }
  });

  // textos dos documentos + dados fixos já conhecidos do termo do Murano (docs-referencia).
  // As 3 datas de assembleia/vistoria entram fictícias (marcadas em /admin/documentos) até virem as reais.
  await db.documentoTemplate.createMany({
    data: [
      {
        empreendimentoId: empreendimento.id,
        tipo: TIPO_TERMO,
        conteudo: TERMO_PADRAO,
        variaveis: {
          dataConclusaoObras: '28/08/2026',
          numeroCertidao: '24/0544/2026',
          // valores FICTÍCIOS pra destravar testes — trocar pelas datas reais em /admin/documentos
          dataAssembleia: '15/11/2026',
          dataVistoriaInicio: '10/11/2026',
          dataVistoriaFim: '12/11/2026',
          ficticias: ['dataAssembleia', 'dataVistoriaInicio', 'dataVistoriaFim']
        }
      },
      { empreendimentoId: empreendimento.id, tipo: TIPO_CHECKLIST, conteudo: CHECKLIST_PADRAO }
    ]
  });

  let comComprador = 0;
  let semComprador = 0;
  let totalCompradores = 0;

  for (const u of dados) {
    const unidade = await db.unidade.create({
      data: {
        empreendimentoId: empreendimento.id,
        bloco: String(u.bloco),
        numero: String(u.numero),
        tipologia: u.tipologia ?? null,
        grupo: u.grupo ?? null,
        statusQuitacao: STATUS_QUITACAO[u.statusQuitacao] ?? null,
        compradores: u.compradores, // fonte de leitura dos documentos; o histórico abaixo é só registro
        observacoes: u.compradores.length === 0 ? 'Sem comprador cadastrado na base importada.' : null
      }
    });

    if (u.compradores.length === 0) {
      semComprador++;
      continue;
    }
    comComprador++;

    for (const c of u.compradores) {
      totalCompradores++;
      await db.historicoUnidade.create({
        data: {
          unidadeId: unidade.id,
          tipo: 'cadastro',
          descricao: `${c.nome} — ${
            c.principal ? 'comprador principal' : 'comprador'
          } (importado da base de entrega de chaves do Murano).`
        }
      });
    }
  }

  console.log('Importação concluída.');
  console.log(`  Unidades criadas: ${dados.length}`);
  console.log(`  Com comprador:    ${comComprador} (${totalCompradores} comprador(es) no total)`);
  console.log(`  Sem comprador:    ${semComprador}`);
}

main()
  .catch((err) => {
    console.error('Falhou:', err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
