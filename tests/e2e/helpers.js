import { ADMIN } from '../preparar-banco-teste.js';

/** Entra na área da equipe como admin de teste. */
export async function entrarComoAdmin(page, credenciais = ADMIN) {
  await page.goto('/admin/login', { waitUntil: 'networkidle' });
  await page.fill('input[name=email]', credenciais.email);
  await page.fill('input[name=senha]', credenciais.senha);
  await Promise.all([page.waitForURL((u) => !u.pathname.endsWith('/login')), page.click('button[type=submit]')]);
}

/** Baixa um endpoint usando a sessão do navegador (cookies) e devolve { status, tipo, corpo }. */
export async function baixar(page, caminho) {
  const r = await page.request.get(caminho);
  return { status: r.status(), tipo: r.headers()['content-type'], corpo: await r.body() };
}
