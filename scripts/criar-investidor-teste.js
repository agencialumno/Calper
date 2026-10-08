// Script único de QA — cria um empreendimento (se precisar), uma unidade e um
// investidor de teste com senha já definida e tudo pronto pra testar o fluxo
// completo (primeiro acesso, tutorial, agendamento etc). Roda uma vez e
// mostra o CPF/senha no console.
//
// Uso: bun scripts/criar-investidor-teste.js

import { PrismaClient } from '@prisma/client';
import { randomBytes, scryptSync } from 'node:crypto';

const db = new PrismaClient();

function hashSenha(senha) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(senha, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

const CPF_TESTE = '11122233396'; // CPF válido (dígitos verificadores corretos), reservado pra QA
const SENHA_TEMPORARIA = 'Teste@123';

async function main() {
  let empreendimento = await db.empreendimento.findFirst({ where: { nome: 'Empreendimento QA' } });
  if (!empreendimento) {
    empreendimento = await db.empreendimento.create({
      data: { nome: 'Empreendimento QA', estagioAtual: 'Início da Jornada' }
    });
    console.log(`Empreendimento criado: ${empreendimento.nome}`);
  }

  let unidade = await db.unidade.findFirst({
    where: { empreendimentoId: empreendimento.id, bloco: 'A', numero: '101' }
  });
  if (!unidade) {
    unidade = await db.unidade.create({
      data: { empreendimentoId: empreendimento.id, bloco: 'A', numero: '101', status: 'regularizado' }
    });
    console.log(`Unidade criada: ${unidade.numero} — Bloco ${unidade.bloco}`);
  }

  let investidor = await db.investidor.findUnique({ where: { cpf: CPF_TESTE } });
  if (investidor) {
    // já existe — reseta pra voltar ao estado "primeiro acesso", útil pra
    // testar o fluxo de novo sem ficar criando investidor atrás de investidor
    investidor = await db.investidor.update({
      where: { id: investidor.id },
      data: {
        senhaHash: hashSenha(SENHA_TEMPORARIA),
        primeiroAcesso: true,
        termoAceitoEm: null,
        tutorialVisto: false
      }
    });
    console.log('Investidor de teste já existia — resetado pra "primeiro acesso" de novo.');
  } else {
    investidor = await db.investidor.create({
      data: {
        nome: 'Investidor Teste QA',
        cpf: CPF_TESTE,
        senhaHash: hashSenha(SENHA_TEMPORARIA),
        primeiroAcesso: true
      }
    });
    console.log('Investidor de teste criado.');
  }

  const vinculo = await db.unidadeInvestidor.findUnique({
    where: { unidadeId_investidorId: { unidadeId: unidade.id, investidorId: investidor.id } }
  });
  if (!vinculo) {
    await db.unidadeInvestidor.create({
      data: { unidadeId: unidade.id, investidorId: investidor.id, email: 'lumno.contato@gmail.com' }
    });
    console.log('Vínculo unidade↔investidor criado (e-mail inicial: lumno.contato@gmail.com).');
  }

  console.log('\n--- Credenciais de teste ---');
  console.log(`CPF:   ${CPF_TESTE.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}`);
  console.log(`Senha: ${SENHA_TEMPORARIA}`);
  console.log('----------------------------\n');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());