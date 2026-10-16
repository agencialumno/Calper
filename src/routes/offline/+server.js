import html from '../../../static/offline.html?raw';

// O service worker pré-carrega a tela de "sem conexão" nesta URL (o build do PWA registra
// static/offline.html como "/offline"); sem esta rota o pré-cache recebia 404.
export const prerender = true;

export function GET() {
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
