// Dados de exemplo pra testar o login localmente.
// Rodar com: node prisma/seed.js
import { PrismaClient } from '@prisma/client';
import { hashSenha } from '../src/lib/server/auth.js';

const db = new PrismaClient();

async function main() {
  const empreendimento = await db.empreendimento.create({
    data: { nome: 'Arte Botânica', estagioAtual: 'Início das Obras' }
  });

  const unidade1 = await db.unidade.create({
    data: { empreendimentoId: empreendimento.id, bloco: 'B', numero: '1204' }
  });
  const unidade2 = await db.unidade.create({
    data: { empreendimentoId: empreendimento.id, bloco: 'A', numero: '302' }
  });

  // senha temporária de teste: Calper@123 (troque no primeiro acesso real)
  const investidor = await db.investidor.create({
    data: {
      nome: 'Mariana Souza',
      cpf: '12345678900',
      senhaHash: hashSenha('Calper@123'),
      primeiroAcesso: true
    }
  });

  await db.unidadeInvestidor.createMany({
    data: [
      { unidadeId: unidade1.id, investidorId: investidor.id, email: 'mariana@exemplo.com' },
      { unidadeId: unidade2.id, investidorId: investidor.id, email: 'mariana@exemplo.com' }
    ]
  });

  await db.funcionario.create({
    data: {
      nome: 'Admin Calper',
      email: 'admin@calper.com.br',
      senhaHash: hashSenha('Calper@123'),
      perfil: 'admin'
    }
  });

  console.log('Seed concluído.');
  console.log('Investidor de teste — CPF: 123.456.789-00 / senha: Calper@123');
  console.log('Funcionário de teste — e-mail: admin@calper.com.br / senha: Calper@123');
}

main().finally(() => db.$disconnect());
