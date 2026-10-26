// Backup completo do banco (schema + dados) sem depender do pg_dump.
// Uso: node --env-file=.env scripts/backup-banco.js   (ou: bun scripts/backup-banco.js)
// Saída em backups/backup-AAAA-MM-DD-HHMM/ (pasta ignorada pelo git — contém dados pessoais):
//   schema.sql         SQL do schema atual (prisma migrate diff)
//   migracoes.json     migrações já aplicadas no banco (_prisma_migrations)
//   dados/<Modelo>.ndjson   uma linha JSON por registro, na ordem de dependência das tabelas
//   manifesto.json     contagem de registros por tabela (para conferir o backup)
// Restaurar: scripts/restaurar-backup.js
import { execSync } from 'node:child_process';
import { createWriteStream, mkdirSync, writeFileSync } from 'node:fs';
import { once } from 'node:events';
import { join } from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';

const db = new PrismaClient();

/** Modelos em ordem de dependência (pais antes dos filhos), a partir das relações do schema. */
export function modelosEmOrdem() {
  const modelos = Prisma.dmmf.datamodel.models;
  const deps = new Map(
    modelos.map((m) => [
      m.name,
      new Set(m.fields.filter((f) => f.relationFromFields?.length).map((f) => f.type).filter((t) => t !== m.name))
    ])
  );
  const ordem = [];
  const visitando = new Set();
  const visitar = (nome) => {
    if (ordem.includes(nome) || visitando.has(nome)) return;
    visitando.add(nome);
    for (const d of deps.get(nome)) visitar(d);
    visitando.delete(nome);
    ordem.push(nome);
  };
  modelos.forEach((m) => visitar(m.name));
  return ordem;
}

/** Nome da chave primária do modelo (nem todo modelo tem `id`; ex.: FuncionarioFoto usa funcionarioId). */
const chavePrimaria = (nome) => Prisma.dmmf.datamodel.models.find((m) => m.name === nome).fields.find((f) => f.isId).name;

const delegate = (nome) => db[nome.charAt(0).toLowerCase() + nome.slice(1)];

async function main() {
  const agora = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const carimbo = `${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-${pad(agora.getDate())}-${pad(agora.getHours())}${pad(agora.getMinutes())}`;
  const pasta = join('backups', `backup-${carimbo}`);
  mkdirSync(join(pasta, 'dados'), { recursive: true });

  writeFileSync(
    join(pasta, 'schema.sql'),
    execSync('npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script', {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024
    })
  );

  const migracoes = await db.$queryRawUnsafe(
    'SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY started_at'
  );
  writeFileSync(join(pasta, 'migracoes.json'), JSON.stringify(migracoes, null, 2));

  const manifesto = { criadoEm: agora.toISOString(), tabelas: {} };
  for (const nome of modelosEmOrdem()) {
    const saida = createWriteStream(join(pasta, 'dados', `${nome}.ndjson`));
    let total = 0;
    const pk = chavePrimaria(nome);
    let cursor;
    for (;;) {
      // páginas pequenas: algumas tabelas guardam arquivos em base64 (procuração, PDFs)
      const lote = await delegate(nome).findMany({
        take: 100,
        orderBy: { [pk]: 'asc' },
        ...(cursor ? { skip: 1, cursor: { [pk]: cursor } } : {})
      });
      if (lote.length === 0) break;
      for (const r of lote) {
        if (!saida.write(JSON.stringify(r) + '\n')) await once(saida, 'drain');
      }
      total += lote.length;
      cursor = lote[lote.length - 1][pk];
    }
    saida.end();
    await once(saida, 'finish');
    manifesto.tabelas[nome] = total;
  }

  writeFileSync(join(pasta, 'manifesto.json'), JSON.stringify(manifesto, null, 2));
  console.log(`Backup em ${pasta}`);
  console.log(manifesto.tabelas);
}

if (import.meta.url === new URL(process.argv[1], 'file:///').href || process.argv[1].endsWith('backup-banco.js')) {
  main()
    .catch((e) => {
      console.error('Falhou:', e);
      process.exitCode = 1;
    })
    .finally(() => db.$disconnect());
}
