// Dados de exemplo pra testar o login localmente.
// Rodar com: bun run db:seed
// Idempotente — pode rodar quantas vezes quiser sem dar erro de duplicidade.
import { PrismaClient } from '@prisma/client';
import { hashSenha } from '../src/lib/server/auth.js';

const db = new PrismaClient();

const TIPOS_EVENTO = [
  { slug: 'visita-obra', nome: 'Visitação à obra', exigeDocumento: true, limitePessoas: 4, ordem: 1 },
  { slug: 'vistoria', nome: 'Vistoria de unidade', exigeDocumento: false, limitePessoas: 2, ordem: 2 },
  { slug: 'escritura', nome: 'Assinatura da Escritura', exigeDocumento: true, limitePessoas: 3, ordem: 3 },
  { slug: 'entrega-chaves', nome: 'Entrega de chaves', exigeDocumento: false, limitePessoas: 2, ordem: 4 },
  { slug: 'atendimento', nome: 'Atendimento presencial', exigeDocumento: false, limitePessoas: 2, ordem: 5 }
];

async function main() {
  for (const tipo of TIPOS_EVENTO) {
    await db.tipoEvento.upsert({ where: { slug: tipo.slug }, update: tipo, create: tipo });
  }

  let empreendimento = await db.empreendimento.findFirst({ where: { nome: 'Arte Botânica' } });
  if (!empreendimento) {
    empreendimento = await db.empreendimento.create({
      data: { nome: 'Arte Botânica', estagioAtual: 'Início das Obras' }
    });
  }

  const unidade1 = await db.unidade.upsert({
    where: {
      empreendimentoId_bloco_numero: { empreendimentoId: empreendimento.id, bloco: 'B', numero: '1204' }
    },
    update: {},
    create: { empreendimentoId: empreendimento.id, bloco: 'B', numero: '1204' }
  });
  const unidade2 = await db.unidade.upsert({
    where: {
      empreendimentoId_bloco_numero: { empreendimentoId: empreendimento.id, bloco: 'A', numero: '302' }
    },
    update: {},
    create: { empreendimentoId: empreendimento.id, bloco: 'A', numero: '302' }
  });

  // CPF de teste válido (passa na validação de dígito verificador: 111.444.777-35)
  // senha temporária de teste: Calper@123 (troque no primeiro acesso real)
  const investidor = await db.investidor.upsert({
    where: { cpf: '11144477735' },
    update: {},
    create: {
      nome: 'Mariana Souza',
      cpf: '11144477735',
      senhaHash: hashSenha('Calper@123'),
      primeiroAcesso: true
    }
  });

  await db.unidadeInvestidor.upsert({
    where: { unidadeId_investidorId: { unidadeId: unidade1.id, investidorId: investidor.id } },
    update: {},
    create: { unidadeId: unidade1.id, investidorId: investidor.id, email: 'mariana@exemplo.com' }
  });
  await db.unidadeInvestidor.upsert({
    where: { unidadeId_investidorId: { unidadeId: unidade2.id, investidorId: investidor.id } },
    update: {},
    create: { unidadeId: unidade2.id, investidorId: investidor.id, email: 'mariana@exemplo.com' }
  });

  // --- segundo investidor de teste: já passou do primeiro acesso, 1 única unidade
  // (login direto, sem tela de troca de senha nem de seleção de unidade) ---
  let empreendimento2 = await db.empreendimento.findFirst({ where: { nome: 'Nexus Macaé' } });
  if (!empreendimento2) {
    empreendimento2 = await db.empreendimento.create({
      data: { nome: 'Nexus Macaé', estagioAtual: 'Entrega das Chaves' }
    });
  }

  const unidade3 = await db.unidade.upsert({
    where: {
      empreendimentoId_bloco_numero: { empreendimentoId: empreendimento2.id, bloco: 'Único', numero: '87' }
    },
    update: {},
    create: { empreendimentoId: empreendimento2.id, bloco: 'Único', numero: '87' }
  });

  // CPF de teste válido: 123.456.789-09
  const investidor2 = await db.investidor.upsert({
    where: { cpf: '12345678909' },
    update: {},
    create: {
      nome: 'Carlos Pereira',
      cpf: '12345678909',
      senhaHash: hashSenha('Calper@123'),
      primeiroAcesso: false
    }
  });

  await db.unidadeInvestidor.upsert({
    where: { unidadeId_investidorId: { unidadeId: unidade3.id, investidorId: investidor2.id } },
    update: {},
    create: { unidadeId: unidade3.id, investidorId: investidor2.id, email: 'carlos@exemplo.com' }
  });

  await db.funcionario.upsert({
    where: { email: 'admin@calper.com.br' },
    update: {},
    create: {
      nome: 'Admin Calper',
      email: 'admin@calper.com.br',
      senhaHash: hashSenha('Calper@123'),
      perfil: 'admin'
    }
  });

  console.log('Seed concluído.');
  console.log('Investidor 1 (1º acesso, 2 unidades) — CPF: 111.444.777-35 / senha: Calper@123');
  console.log('Investidor 2 (acesso direto, 1 unidade) — CPF: 123.456.789-09 / senha: Calper@123');
  console.log('Funcionário de teste — e-mail: admin@calper.com.br / senha: Calper@123');
}

main().finally(() => db.$disconnect());
