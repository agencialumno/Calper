// Converte os perfis da equipe para o modelo novo (admin | supervisor | colaborador). NÃO apaga ninguém: só
// atualiza o campo `perfil`. Idempotente (pode rodar de novo sem efeito).
//
// QUANDO RODAR: DEPOIS que a versão nova do app estiver no ar. A versão antiga só conhece "admin", "gestao" e
// "atendimento": quem virasse supervisor/colaborador antes do deploy ficaria sem acesso até o deploy terminar.
//
// Uso: node --env-file=.env scripts/migrar-perfis.js            (mostra o que mudaria, não grava)
//      node --env-file=.env scripts/migrar-perfis.js --aplicar  (grava)
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const aplicar = process.argv.includes('--aplicar');

// pessoas citadas pela Calper (casadas pelo e-mail)
const PERFIL_POR_EMAIL = {
  'veronica.simao@calper.com.br': 'admin',
  'ana.almeida@calper.com.br': 'supervisor',
  'matheus.veiga@calper.com.br': 'supervisor',
  'debora.braga@calper.com.br': 'supervisor',
  'wyverson.teixeira@calper.com.br': 'colaborador',
  'imaiara.lourenco@calper.com.br': 'colaborador',
  'monique.silva@calper.com.br': 'colaborador',
  'gabriel.carneiro@calper.com.br': 'colaborador',
  'daiana.oliveira@calper.com.br': 'colaborador'
};
// nomes antigos (para quem não está na lista acima); "admin" continua admin (ex.: Admin Calper)
const RENOMEAR = { gestao: 'supervisor', atendimento: 'colaborador' };

async function main() {
  const funcionarios = await db.funcionario.findMany({ orderBy: { nome: 'asc' } });
  const naoEncontrados = Object.keys(PERFIL_POR_EMAIL).filter((e) => !funcionarios.some((f) => f.email.toLowerCase() === e));

  let mudancas = 0;
  for (const f of funcionarios) {
    const alvo = PERFIL_POR_EMAIL[f.email.toLowerCase()] ?? RENOMEAR[f.perfil] ?? f.perfil;
    if (alvo === f.perfil) {
      console.log(`  = ${f.nome} (${f.email}): ${f.perfil}`);
      continue;
    }
    mudancas++;
    console.log(`  ${aplicar ? '→' : '(simulação) →'} ${f.nome} (${f.email}): ${f.perfil} → ${alvo}`);
    if (aplicar) await db.funcionario.update({ where: { id: f.id }, data: { perfil: alvo } });
  }

  const admins = funcionarios.filter((f) => (PERFIL_POR_EMAIL[f.email.toLowerCase()] ?? RENOMEAR[f.perfil] ?? f.perfil) === 'admin' && f.ativo);
  console.log(`\n${mudancas} perfil(is) ${aplicar ? 'atualizado(s)' : 'seriam atualizados (rode com --aplicar)'}; ${admins.length} admin(s) ativo(s) ao final.`);
  if (naoEncontrados.length) console.log(`Não encontrados (ignorados): ${naoEncontrados.join(', ')}`);
  if (admins.length === 0) throw new Error('Isto deixaria o sistema sem admin ativo — nada foi gravado.');
}

main()
  .catch((e) => {
    console.error('Falhou:', e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
