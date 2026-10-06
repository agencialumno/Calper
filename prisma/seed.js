// Dados de exemplo pra testar o login localmente.
// Rodar com: bun run db:seed
// Idempotente — pode rodar quantas vezes quiser sem dar erro de duplicidade.
import { PrismaClient } from '@prisma/client';
import { hashSenha } from '../src/lib/server/auth.js';

const db = new PrismaClient();

async function main() {
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
  console.log('Investidor de teste — CPF: 111.444.777-35 / senha: Calper@123');
  console.log('Funcionário de teste — e-mail: admin@calper.com.br / senha: Calper@123');
}

main().finally(() => db.$disconnect());
