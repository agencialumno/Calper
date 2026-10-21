import { describe, expect, it } from 'vitest';
import { bloqueioAdmin } from '../../src/lib/server/guardaAdmin.js';

const evento = (caminho, { metodo = 'GET', perfil = null } = {}) => ({
  url: new URL(`https://exemplo.com${caminho}`),
  request: { method: metodo },
  locals: { funcionario: perfil ? { perfil } : null }
});

describe('guarda da área da equipe (/admin)', () => {
  it('sem sessão: páginas redirecionam ao login (303), ações e endpoints respondem 401', () => {
    for (const c of ['/admin/dashboard', '/admin/presenca/exportar', '/admin/unidades/x/arquivos', '/admin/qualquer-coisa']) {
      const r = bloqueioAdmin(evento(c));
      expect(r.status, c).toBe(303);
      expect(r.headers.get('location')).toBe('/admin/login');
    }
    for (const m of ['POST', 'PUT', 'DELETE']) {
      expect(bloqueioAdmin(evento('/admin/documentos', { metodo: m })).status).toBe(401);
    }
  });
  it('rotas públicas da equipe passam sem sessão', () => {
    for (const c of ['/admin/login', '/admin/cadastro', '/admin/assinatura-retorno', '/admin/logout', '/admin']) {
      expect(bloqueioAdmin(evento(c)), c).toBeNull();
      expect(bloqueioAdmin(evento(c, { metodo: 'POST' })), c).toBeNull();
    }
  });
  it('fora de /admin não interfere', () => {
    expect(bloqueioAdmin(evento('/agendar-entrega-chaves', { metodo: 'POST' }))).toBeNull();
    expect(bloqueioAdmin(evento('/painel'))).toBeNull();
    expect(bloqueioAdmin(evento('/administrador'))).toBeNull();
  });
  it('admin e gestão acessam tudo', () => {
    for (const perfil of ['admin', 'gestao']) {
      expect(bloqueioAdmin(evento('/admin/presenca/exportar', { perfil }))).toBeNull();
      expect(bloqueioAdmin(evento('/admin/documentos', { metodo: 'POST', perfil }))).toBeNull();
    }
  });
  it('atendimento só usa check-in e sem-acesso; o resto é barrado', () => {
    expect(bloqueioAdmin(evento('/admin/checkin', { perfil: 'atendimento' }))).toBeNull();
    expect(bloqueioAdmin(evento('/admin/checkin/abc', { perfil: 'atendimento', metodo: 'POST' }))).toBeNull();
    expect(bloqueioAdmin(evento('/admin/sem-acesso', { perfil: 'atendimento' }))).toBeNull();
    const pagina = bloqueioAdmin(evento('/admin/dashboard', { perfil: 'atendimento' }));
    expect(pagina.status).toBe(303);
    expect(pagina.headers.get('location')).toBe('/admin/sem-acesso');
    expect(bloqueioAdmin(evento('/admin/presenca/exportar', { perfil: 'atendimento' })).status).toBe(303);
    expect(bloqueioAdmin(evento('/admin/documentos', { perfil: 'atendimento', metodo: 'POST' })).status).toBe(403);
  });
});
