import { describe, expect, it } from 'vitest';
import { bloqueioAdmin } from '../../src/lib/server/guardaAdmin.js';
import { normalizarPerfil, permissaoNoCaminho } from '../../src/lib/perfis.js';

const evento = (caminho, { metodo = 'GET', perfil = null } = {}) => ({
  url: new URL(`https://exemplo.com${caminho}`),
  request: { method: metodo },
  locals: { funcionario: perfil ? { perfil } : null }
});

const PAGINAS = ['/admin/dashboard', '/admin/unidades', '/admin/unidades/abc', '/admin/agenda', '/admin/entrega-chaves', '/admin/presenca', '/admin/documentos', '/admin/conta'];
const SO_SUPERVISOR_E_ADMIN = ['/admin/questionarios', '/admin/questionarios/x', '/admin/atualizacoes', '/admin/empreendimentos', '/admin/empreendimentos/x', '/admin/unidades/nova', '/admin/unidades/importar'];

describe('guarda da área da equipe (/admin)', () => {
  it('sem sessão: páginas redirecionam ao login (303), ações e endpoints respondem 401', () => {
    for (const c of ['/admin/dashboard', '/admin/presenca/exportar', '/admin/unidades/x/arquivos', '/admin/qualquer-coisa', '/admin/usuarios']) {
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

  it('admin acessa tudo, inclusive usuários e logs', () => {
    for (const c of [...PAGINAS, ...SO_SUPERVISOR_E_ADMIN, '/admin/usuarios', '/admin/logs']) {
      expect(bloqueioAdmin(evento(c, { perfil: 'admin' })), c).toBeNull();
      expect(bloqueioAdmin(evento(c, { perfil: 'admin', metodo: 'POST' })), c).toBeNull();
    }
  });

  it('supervisor edita tudo, menos usuários e logs (páginas redirecionam, ações dão 403)', () => {
    for (const c of [...PAGINAS, ...SO_SUPERVISOR_E_ADMIN]) {
      expect(bloqueioAdmin(evento(c, { perfil: 'supervisor' })), c).toBeNull();
      expect(bloqueioAdmin(evento(c, { perfil: 'supervisor', metodo: 'POST' })), c).toBeNull();
    }
    for (const c of ['/admin/usuarios', '/admin/logs']) {
      const pagina = bloqueioAdmin(evento(c, { perfil: 'supervisor' }));
      expect(pagina.status, c).toBe(303);
      expect(pagina.headers.get('location')).toBe('/admin/sem-acesso');
      expect(bloqueioAdmin(evento(c, { perfil: 'supervisor', metodo: 'POST' })).status, c).toBe(403);
    }
  });

  it('colaborador: lê as páginas, mas não vê questionários, atualizações, empreendimentos, usuários e logs', () => {
    for (const c of PAGINAS) expect(bloqueioAdmin(evento(c, { perfil: 'colaborador' })), c).toBeNull();
    for (const c of [...SO_SUPERVISOR_E_ADMIN, '/admin/usuarios', '/admin/logs']) {
      const r = bloqueioAdmin(evento(c, { perfil: 'colaborador' }));
      expect(r.status, c).toBe(303);
      expect(r.headers.get('location')).toBe('/admin/sem-acesso');
    }
  });
  it('colaborador: não altera nada, exceto o atendimento presencial e a própria conta', () => {
    for (const c of ['/admin/unidades/abc', '/admin/documentos', '/admin/agenda', '/admin/unidades/abc/status', '/admin/presenca', '/admin/dashboard']) {
      expect(bloqueioAdmin(evento(c, { perfil: 'colaborador', metodo: 'POST' })).status, c).toBe(403);
    }
    for (const c of [
      '/admin/entrega-chaves/abc',
      '/admin/entrega-chaves/abc/assinar',
      '/admin/checkin/abc',
      '/admin/unidades/abc/termo-entrega',
      '/admin/unidades/abc/checklist',
      '/admin/unidades/abc/documento-pdf',
      '/admin/conta',
      '/admin/logout'
    ]) {
      expect(bloqueioAdmin(evento(c, { perfil: 'colaborador', metodo: 'POST' })), c).toBeNull();
    }
  });

  it('nomes antigos de perfil continuam valendo (gestao = supervisor, atendimento = colaborador)', () => {
    expect(normalizarPerfil('gestao')).toBe('supervisor');
    expect(normalizarPerfil('atendimento')).toBe('colaborador');
    expect(normalizarPerfil('qualquer-coisa')).toBe('colaborador'); // desconhecido = menor privilégio
    expect(permissaoNoCaminho('gestao', 'POST', '/admin/documentos')).toBe('ok');
    expect(permissaoNoCaminho('atendimento', 'POST', '/admin/documentos')).toBe('somente-leitura');
  });
  it('a tela sem-acesso é de qualquer perfil logado', () => {
    for (const perfil of ['admin', 'supervisor', 'colaborador']) expect(bloqueioAdmin(evento('/admin/sem-acesso', { perfil }))).toBeNull();
  });
});
