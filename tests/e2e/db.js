import { createRequire } from 'node:module';
import { urlDoBancoDeTeste } from '../preparar-banco-teste.js';

const require = createRequire(import.meta.url);

/** Consulta direta ao BANCO DE TESTE (schema calper_test) para conferir o que as telas gravaram. */
export async function comBanco(fn) {
  const { PrismaClient } = require('@prisma/client');
  const db = new PrismaClient({ datasources: { db: { url: urlDoBancoDeTeste() } } });
  try {
    return await fn(db);
  } finally {
    await db.$disconnect();
  }
}
