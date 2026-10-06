# Calper — Plataforma do Investidor

Stack: SvelteKit + Tailwind CSS + Prisma (PostgreSQL) + Vercel. Runtime/gerenciador de pacotes: **Bun**.

## Assets
- `static/logo.png` — logo colorida (fundos claros)
- `static/logo-branca.png` — logo branca (fundos escuros: login, sidebar admin)
- `static/favicon.png` — favicon
- `static/background-login.jpg` — foto de fundo da tela de login

## Rodando localmente

1. Configure o banco (Supabase → Project Settings → Database → Connection string):
   ```
   cp .env.example .env
   # edite DATABASE_URL (pooler, porta 6543) e DIRECT_URL (direta, porta 5432)
   ```
2. Instale dependências e gere o schema:
   ```
   bun install
   bun run db:migrate
   bun run db:seed
   ```
3. Suba o servidor:
   ```
   bun run dev
   ```
4. Acesse `/login` e entre com o usuário de teste do seed:
   - CPF: `123.456.789-00`
   - Senha: `Calper@123` (primeiro acesso — vai pedir troca de senha)

## Módulo implementado: Autenticação

- Login por CPF + senha (`/login`)
- Primeiro acesso força troca de senha (`/primeiro-acesso`)
- Investidor com mais de uma unidade escolhe qual acessar (`/login/unidades`)
- Sessão por cookie httpOnly, validada em `src/hooks.server.js`
- Rotas protegidas agrupadas em `src/routes/(app)/` — exigem sessão + unidade selecionada
- Cabeçalho do painel mostra só "Unidade X — Bloco Y" (sem saudação pessoal, já que a conta é da unidade)
- Logout: `POST /logout`

### Próximo módulo
Cadastro de unidades (dossiê completo) + importação em massa via planilha.
