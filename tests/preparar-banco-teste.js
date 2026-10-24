// Prepara o BANCO DE TESTE: limpa o schema `calper_test` e cria os dados mínimos dos testes de ponta a ponta.
//
// SEGURANÇA: só roda contra a URL de DATABASE_URL_TESTE (arquivo .env.test, ignorado pelo git) e só se ela apontar
// para o schema `calper_test`. Nunca use a URL de produção aqui — as tabelas do schema são esvaziadas a cada execução.
import fs from 'node:fs';
import { createRequire } from 'node:module';

export const DATAS_ABERTAS = ['2030-10-28', '2030-10-29', '2030-10-30'];
export const DIA_COM_LIMITE_1 = '2030-10-30'; // limite de 1 agendamento por hora (testa a lotação)
export const ADMIN = { email: 'teste.admin@example.com', senha: 'Teste@12345' };
export const SUPERVISOR = { email: 'teste.supervisor@example.com', senha: 'Teste@12345' };
export const COLABORADOR = { email: 'teste.colaborador@example.com', senha: 'Teste@12345' };
export const ATENDIMENTO = COLABORADOR; // nome antigo do perfil colaborador

/** Lê DATABASE_URL_TESTE do .env.test (ou do ambiente) e confere que é o schema de teste. */
export function urlDoBancoDeTeste() {
  let url = process.env.DATABASE_URL_TESTE;
  if (!url && fs.existsSync('.env.test')) {
    const linha = fs.readFileSync('.env.test', 'utf8').split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL_TESTE='));
    url = linha?.slice('DATABASE_URL_TESTE='.length).replace(/^"|"$/g, '');
  }
  if (!url) throw new Error('DATABASE_URL_TESTE não encontrada (crie o arquivo .env.test — veja tests/README.md).');
  if (new URL(url).searchParams.get('schema') !== 'calper_test') {
    throw new Error('Recusado: DATABASE_URL_TESTE precisa apontar para o schema calper_test (nunca para produção).');
  }
  return url;
}

export async function prepararBancoDeTeste() {
  process.env.DATABASE_URL = urlDoBancoDeTeste();
  const require = createRequire(import.meta.url);
  const { PrismaClient } = require('@prisma/client');
  const { hashSenha } = await import('../src/lib/server/auth.js');
  const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

  try {
    // esvazia todas as tabelas do schema de teste (exceto o controle de migrações)
    const tabelas = await db.$queryRawUnsafe(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'calper_test' AND tablename <> '_prisma_migrations'`
    );
    if (tabelas.length) {
      const lista = tabelas.map((t) => `"calper_test"."${t.tablename}"`).join(', ');
      await db.$executeRawUnsafe(`TRUNCATE TABLE ${lista} RESTART IDENTITY CASCADE`);
    }

    const tipos = [
      { slug: 'visita-obra', nome: 'Visitação à obra', exigeDocumento: true, limitePessoas: 4, ordem: 1 },
      { slug: 'vistoria', nome: 'Vistoria de unidade', exigeDocumento: false, limitePessoas: 2, ordem: 2 },
      { slug: 'escritura', nome: 'Assinatura da Escritura', exigeDocumento: true, limitePessoas: 3, ordem: 3 },
      { slug: 'entrega-chaves', nome: 'Entrega de chaves', exigeDocumento: false, limitePessoas: 2, ordem: 4 },
      { slug: 'atendimento', nome: 'Atendimento presencial', exigeDocumento: false, limitePessoas: 2, ordem: 5 }
    ];
    for (const t of tipos) await db.tipoEvento.create({ data: t });
    const entrega = await db.tipoEvento.findUnique({ where: { slug: 'entrega-chaves' } });

    const murano = await db.empreendimento.create({
      data: { nome: 'Murano Residencial (TESTE)', etapa: 'entrega_chaves', estagioAtual: 'Entrega de chaves' }
    });
    const unidades = {};
    for (const [numero, compradores] of [
      ['101', [{ nome: 'COMPRADOR UM TESTE', principal: true }]],
      ['102', [{ nome: 'COMPRADOR DOIS TESTE', principal: true }]],
      ['103', [{ nome: 'COMPRADOR TRES TESTE', principal: true }]],
      ['104', [{ nome: 'COMPRADOR QUATRO TESTE', principal: true }]],
      ['105', [{ nome: 'COMPRADOR CINCO TESTE', principal: true }, { nome: 'CO-COMPRADOR CINCO TESTE', principal: false }]],
      ['106', [{ nome: 'COMPRADOR SEIS TESTE', principal: true }]],
      ['107', [{ nome: 'COMPRADOR SETE TESTE', principal: true }]]
    ]) {
      unidades[numero] = await db.unidade.create({
        data: {
          empreendimentoId: murano.id, bloco: '2', numero, tipologia: '2 QUARTOS', statusQuitacao: 'quitada', compradores,
          // As unidades 106 e 107 ficam FORA da planilha dos testes de importação e já têm os dados da base consolidada
          // (aparecem nas etiquetas e no "ver mais"); as demais começam sem vistoria/escritura pra a importação ter o que atualizar.
          ...(['106', '107'].includes(numero)
            ? {
                grupo: 'A', vistoriaStatus: 'APROVADA', vistoriaAprovada: true, escrituraAtual: 'PROMESSA DE COMPRA E VENDA', statusVenda: 'VENDIDA',
                dataVenda: new Date('2024-03-15T00:00:00.000Z'), vencidoPago: 123456.78, vencidoNaoPago: 0, saldoVincendo: 0,
                faseEscritura: 'SIM (1ª FASE)', escrituraALavrar: 'COMPRA E VENDA'
              }
            : {})
        }
      });
    }

    // modelo do termo editado pela equipe: a importação (inclusive "sobrescrever") não pode apagá-lo
    await db.documentoTemplate.create({
      data: { empreendimentoId: murano.id, tipo: 'termo_entrega_chaves', conteudo: 'TEXTO DO TERMO EDITADO PELA EQUIPE', variaveis: { numeroCertidao: '99/9999/2030' } }
    });

    await db.funcionario.create({ data: { nome: 'Admin Teste', email: ADMIN.email, senhaHash: hashSenha(ADMIN.senha), perfil: 'admin', ativo: true } });
    await db.funcionario.create({ data: { nome: 'Supervisor Teste', email: SUPERVISOR.email, senhaHash: hashSenha(SUPERVISOR.senha), perfil: 'supervisor', ativo: true } });
    await db.funcionario.create({ data: { nome: 'Colaborador Teste', email: COLABORADOR.email, senhaHash: hashSenha(COLABORADOR.senha), perfil: 'colaborador', ativo: true } });
    const investidor = await db.investidor.create({ data: { nome: '[TESTE] Investidor', cpf: '11144477735', senhaHash: hashSenha('Teste@12345'), primeiroAcesso: false } });

    for (const data of DATAS_ABERTAS) {
      await db.agendaDia.create({ data: { data, aberto: true, ...(data === DIA_COM_LIMITE_1 ? { limitePorHora: 1 } : {}) } });
    }

    // agendamentos prontos para as telas de gestão: 1 entrega concluída, 1 compareceu sem concluir, 1 não compareceu
    const base = { tipoEventoId: entrega.id, investidorId: investidor.id, emailCompareceu: 'agendou@example.com', ehProprietario: true };
    const { PDFDocument } = require('pdf-lib');
    const doc = await PDFDocument.create();
    doc.addPage([200, 200]);
    const pdf = 'data:application/pdf;base64,' + Buffer.from(await doc.save()).toString('base64');
    const concluido = await db.agendamento.create({
      data: { ...base, unidadeId: unidades['101'].id, dataHora: new Date('2030-10-28T09:00:00Z'), qrToken: 'qr-teste-1', status: 'realizado', nomeCompareceu: 'Pessoa Concluida', cpfCompareceu: '52998224725', telefoneCompareceu: '21999990001', retiranteNome: 'Pessoa Concluida' }
    });
    for (const tipo of ['termo', 'checklist']) {
      await db.documentoAssinado.create({ data: { agendamentoId: concluido.id, tipo, status: 'assinado', pdfBase64: pdf, docusignEnvelopeId: 'env-teste', assinadoEm: new Date() } });
    }
    await db.presencaEntrega.create({ data: { agendamentoId: concluido.id, unidadeId: unidades['101'].id, nome: 'Pessoa Concluida', vinculo: 'comprador_principal' } });

    const compareceu = await db.agendamento.create({
      data: { ...base, unidadeId: unidades['102'].id, dataHora: new Date('2030-10-28T10:00:00Z'), qrToken: 'qr-teste-2', status: 'confirmado', nomeCompareceu: 'Pessoa Compareceu', cpfCompareceu: '11144477735', telefoneCompareceu: '21999990002' }
    });
    await db.presencaEntrega.create({ data: { agendamentoId: compareceu.id, unidadeId: unidades['102'].id, nome: 'Pessoa Compareceu', vinculo: 'comprador_principal' } });

    await db.agendamento.create({
      data: { ...base, unidadeId: unidades['103'].id, dataHora: new Date('2030-10-29T11:00:00Z'), qrToken: 'qr-teste-3', status: 'confirmado', nomeCompareceu: 'Pessoa Faltou', cpfCompareceu: '52998224725', telefoneCompareceu: '21999990003', ehProprietario: false, proprietarioNome: 'Dono Real', procuracaoBase64: pdf, procuracaoCpf: '52998224725' }
    });
    await db.procuracaoUnidade.create({ data: { unidadeId: unidades['103'].id, nome: 'Procurador Teste', cpf: '52998224725', origem: 'agendamento', arquivoBase64: pdf } });

    return { unidades };
  } finally {
    await db.$disconnect();
  }
}

// `node tests/preparar-banco-teste.js` (ou `bun run test:db:preparar`) prepara o banco manualmente
if (import.meta.url === new URL(process.argv[1], 'file://').href || process.argv[1]?.endsWith('preparar-banco-teste.js')) {
  prepararBancoDeTeste().then(() => console.log('Banco de teste (schema calper_test) preparado.'));
}
