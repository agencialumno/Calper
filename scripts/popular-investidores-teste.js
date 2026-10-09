// Script de QA — cria 2 investidores de teste, cada um com VÁRIOS imóveis
// (unidades em empreendimentos diferentes), e enche o sistema de dados
// realistas: histórico por unidade, agendamentos em status variados
// (confirmado, realizado com pesquisa respondida, cancelado) e acompanhantes.
// Idempotente — pode rodar quantas vezes quiser sem duplicar nada.
//
// Uso: bun scripts/popular-investidores-teste.js

import { PrismaClient } from '@prisma/client';
import { randomBytes, scryptSync } from 'node:crypto';

const db = new PrismaClient();

function hashSenha(senha) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(senha, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function gerarQrToken() {
  return randomBytes(16).toString('hex');
}

/** Gera um CPF válido (dígitos verificadores corretos) a partir de uma base fixa de 9 dígitos. */
function gerarCpfValido(base9) {
  const calcDigito = (base) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (base.length + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const d1 = calcDigito(base9);
  const d2 = calcDigito(base9 + d1);
  return `${base9}${d1}${d2}`;
}

const SENHA_TESTE = 'Calper@123';

function diasAPartirDeHoje(dias) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  d.setHours(10, 0, 0, 0);
  return d;
}

/** Garante que o empreendimento existe (idempotente por nome). */
async function garantirEmpreendimento(nome, estagioAtual) {
  let emp = await db.empreendimento.findFirst({ where: { nome } });
  if (!emp) {
    emp = await db.empreendimento.create({ data: { nome, estagioAtual } });
    console.log(`  Empreendimento criado: ${nome}`);
  }
  return emp;
}

/** Garante que a unidade existe (idempotente por empreendimento+bloco+número). */
async function garantirUnidade(empreendimentoId, bloco, numero, status = 'regularizado') {
  return db.unidade.upsert({
    where: { empreendimentoId_bloco_numero: { empreendimentoId, bloco, numero } },
    update: {},
    create: { empreendimentoId, bloco, numero, status }
  });
}

/** Garante que o investidor existe (idempotente por CPF) e reseta pra 1º acesso já concluído. */
async function garantirInvestidor(nome, cpf) {
  return db.investidor.upsert({
    where: { cpf },
    update: {},
    create: { nome, cpf, senhaHash: hashSenha(SENHA_TESTE), primeiroAcesso: false }
  });
}

async function vincular(unidadeId, investidorId, email) {
  await db.unidadeInvestidor.upsert({
    where: { unidadeId_investidorId: { unidadeId, investidorId } },
    update: {},
    create: { unidadeId, investidorId, email }
  });
}

async function adicionarHistorico(unidadeId, tipo, descricao) {
  const jaExiste = await db.historicoUnidade.findFirst({ where: { unidadeId, tipo, descricao } });
  if (!jaExiste) {
    await db.historicoUnidade.create({ data: { unidadeId, tipo, descricao } });
  }
}

/** Cria um agendamento de teste pra unidade, se ainda não existir um igual (por unidade+tipo+dataHora). */
async function criarAgendamento({ unidadeId, investidorId, tipoEventoId, dataHora, status, comAcompanhante }) {
  const existente = await db.agendamento.findFirst({ where: { unidadeId, tipoEventoId, dataHora } });
  if (existente) return existente;

  const agendamento = await db.agendamento.create({
    data: {
      unidadeId,
      investidorId,
      tipoEventoId,
      dataHora,
      status,
      qrToken: gerarQrToken(),
      acompanhantes: comAcompanhante ? { create: [{ nome: 'Acompanhante Teste' }] } : undefined
    }
  });

  if (status === 'realizado') {
    await db.pesquisaSatisfacao.upsert({
      where: { agendamentoId: agendamento.id },
      update: {},
      create: {
        agendamentoId: agendamento.id,
        educacaoFuncionarios: 'otimo',
        organizacaoLimpeza: 'muito_bom',
        expectativasAndamento: 'bom',
        clarezaInformacoes: 'otimo',
        acabamentoObra: 'bom',
        atendidoNoHorario: true,
        indicariaCalper: true,
        pontosFortes: 'Atendimento atencioso e pontual.',
        oportunidadesMelhoria: null
      }
    });
  }

  return agendamento;
}

async function main() {
  const tipos = await db.tipoEvento.findMany();
  const tipoPorSlug = Object.fromEntries(tipos.map((t) => [t.slug, t]));
  if (!tipos.length) {
    console.log('Nenhum TipoEvento encontrado — rode "bun run db:seed" primeiro pra criar os tipos de evento.');
    process.exit(1);
  }

  // --- empreendimentos usados nesse povoamento ---
  const arteBotanica = await garantirEmpreendimento('Arte Botânica', 'Início das Obras');
  const nexusMacae = await garantirEmpreendimento('Nexus Macaé', 'Entrega das Chaves');
  const vilaVerde = await garantirEmpreendimento('Vila Verde Residencial', 'Estrutura e Alvenaria');
  const marinaPark = await garantirEmpreendimento('Marina Park', 'Acabamento');

  console.log('\n--- Investidor 1: Roberto Almeida (4 imóveis em 3 empreendimentos) ---');
  const cpf1 = gerarCpfValido('481523967');
  const investidor1 = await garantirInvestidor('Roberto Almeida', cpf1);

  const u1a = await garantirUnidade(arteBotanica.id, 'A', '101');
  const u1b = await garantirUnidade(arteBotanica.id, 'B', '1502');
  const u1c = await garantirUnidade(nexusMacae.id, 'Único', '45');
  const u1d = await garantirUnidade(vilaVerde.id, 'C', '302', 'troca_titularidade');

  for (const u of [u1a, u1b, u1c, u1d]) {
    await vincular(u.id, investidor1.id, 'roberto.almeida@exemplo.com');
    await adicionarHistorico(u.id, 'cadastro', 'Unidade cadastrada no sistema.');
  }
  await adicionarHistorico(u1d.id, 'outro', 'Processo de troca de titularidade em andamento.');

  await criarAgendamento({
    unidadeId: u1a.id,
    investidorId: investidor1.id,
    tipoEventoId: tipoPorSlug['visita-obra'].id,
    dataHora: diasAPartirDeHoje(5),
    status: 'confirmado',
    comAcompanhante: true
  });
  await criarAgendamento({
    unidadeId: u1b.id,
    investidorId: investidor1.id,
    tipoEventoId: tipoPorSlug['vistoria'].id,
    dataHora: diasAPartirDeHoje(-10),
    status: 'realizado',
    comAcompanhante: false
  });
  await criarAgendamento({
    unidadeId: u1c.id,
    investidorId: investidor1.id,
    tipoEventoId: tipoPorSlug['entrega-chaves'].id,
    dataHora: diasAPartirDeHoje(-30),
    status: 'realizado',
    comAcompanhante: false
  });
  await criarAgendamento({
    unidadeId: u1d.id,
    investidorId: investidor1.id,
    tipoEventoId: tipoPorSlug['atendimento'].id,
    dataHora: diasAPartirDeHoje(-3),
    status: 'cancelado',
    comAcompanhante: false
  });

  console.log('\n--- Investidor 2: Fernanda Lima (5 imóveis em 4 empreendimentos) ---');
  const cpf2 = gerarCpfValido('206748351');
  const investidor2 = await garantirInvestidor('Fernanda Lima', cpf2);

  const u2a = await garantirUnidade(arteBotanica.id, 'A', '205');
  const u2b = await garantirUnidade(nexusMacae.id, 'Único', '12');
  const u2c = await garantirUnidade(nexusMacae.id, 'Único', '88');
  const u2d = await garantirUnidade(vilaVerde.id, 'A', '701');
  const u2e = await garantirUnidade(marinaPark.id, 'B', '904');

  for (const u of [u2a, u2b, u2c, u2d, u2e]) {
    await vincular(u.id, investidor2.id, 'fernanda.lima@exemplo.com');
    await adicionarHistorico(u.id, 'cadastro', 'Unidade cadastrada no sistema.');
  }

  await criarAgendamento({
    unidadeId: u2a.id,
    investidorId: investidor2.id,
    tipoEventoId: tipoPorSlug['escritura'].id,
    dataHora: diasAPartirDeHoje(12),
    status: 'confirmado',
    comAcompanhante: true
  });
  await criarAgendamento({
    unidadeId: u2b.id,
    investidorId: investidor2.id,
    tipoEventoId: tipoPorSlug['visita-obra'].id,
    dataHora: diasAPartirDeHoje(2),
    status: 'confirmado',
    comAcompanhante: false
  });
  await criarAgendamento({
    unidadeId: u2c.id,
    investidorId: investidor2.id,
    tipoEventoId: tipoPorSlug['vistoria'].id,
    dataHora: diasAPartirDeHoje(-15),
    status: 'realizado',
    comAcompanhante: false
  });
  await criarAgendamento({
    unidadeId: u2d.id,
    investidorId: investidor2.id,
    tipoEventoId: tipoPorSlug['atendimento'].id,
    dataHora: diasAPartirDeHoje(-1),
    status: 'realizado',
    comAcompanhante: false
  });
  await adicionarHistorico(u2e.id, 'apontamento', 'Investidor relatou infiltração na varanda — aguardando vistoria técnica.');

  // --- algumas atualizações de obra pra engajamento (aparecem no painel do investidor) ---
  const algumFuncionario = await db.funcionario.findFirst();
  if (algumFuncionario) {
    const jaTemAtualizacao = await db.atualizacaoEstagio.findFirst({
      where: { empreendimentoId: vilaVerde.id, titulo: 'Alvenaria concluída no bloco C' }
    });
    if (!jaTemAtualizacao) {
      await db.atualizacaoEstagio.create({
        data: {
          empreendimentoId: vilaVerde.id,
          titulo: 'Alvenaria concluída no bloco C',
          descricao: 'A estrutura e alvenaria do bloco C foram finalizadas. Próxima etapa: instalações elétricas e hidráulicas.',
          publicadoPorId: algumFuncionario.id
        }
      });
    }
  } else {
    console.log('  (nenhum Funcionario encontrado — rode "bun run db:seed" pra ter um admin e gerar atualizações de obra)');
  }

  console.log('\n=== Credenciais de teste ===');
  console.log(`Roberto Almeida — CPF: ${cpf1.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')} / senha: ${SENHA_TESTE}`);
  console.log('  4 imóveis: Arte Botânica (A-101, B-1502), Nexus Macaé (Único-45), Vila Verde (C-302)');
  console.log(`Fernanda Lima — CPF: ${cpf2.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')} / senha: ${SENHA_TESTE}`);
  console.log('  5 imóveis: Arte Botânica (A-205), Nexus Macaé (Único-12, Único-88), Vila Verde (A-701), Marina Park (B-904)');
  console.log('============================\n');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());