# Calper — Plataforma do Investidor

Stack: SvelteKit + Tailwind CSS + Prisma (PostgreSQL) + Vercel. Runtime/gerenciador de pacotes: **Bun**.

## Assets
- `static/logo.png` — logo colorida (fundos claros)
- `static/logo-branca.png` — logo branca (fundos escuros: login, sidebar admin)
- `static/favicon.png` — favicon
- `static/background-login.jpg` — foto de fundo da tela de login

## Rodando localmente

1. Configure o banco (Vercel → projeto → aba Storage → Create Database → Postgres):
   ```
   bun install -g vercel
   vercel link
   vercel env pull .env
   ```
   Isso já baixa o `.env` com `DATABASE_URL` preenchido. Se preferir configurar manualmente, use `.env.example` como base.
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
   - CPF: `111.444.777-35`
   - Senha: `Calper@123` (primeiro acesso — vai pedir troca de senha)

## Módulo implementado: Autenticação

- Login por CPF + senha (`/login`)
- Primeiro acesso força troca de senha (`/primeiro-acesso`)
- Investidor com mais de uma unidade escolhe qual acessar (`/login/unidades`)
- Sessão por cookie httpOnly, validada em `src/hooks.server.js`
- Rotas protegidas agrupadas em `src/routes/(app)/` — exigem sessão + unidade selecionada
- Cabeçalho do painel mostra só "Unidade X — Bloco Y" (sem saudação pessoal, já que a conta é da unidade)
- Logout: `POST /logout`

## Módulo implementado: Cadastro de unidades + importação em massa

Acesso em `/admin` — login separado do investidor, só pra equipe Calper.

- Login do time: `/admin/login` (usuário de teste do seed abaixo)
- Perfis: `admin` e `gestao` têm acesso a este módulo; `atendimento` ainda não (entra no
  módulo de check-in)
- `/admin/unidades` — listagem com busca por unidade/bloco/empreendimento
- `/admin/unidades/nova` — cadastro manual (até 3 investidores por unidade; gera senha
  temporária só para CPF novo; se o CPF já existe, apenas vincula à unidade)
- `/admin/unidades/importar` — importação em massa via CSV:
  1. upload do arquivo
  2. mapeamento de colunas (não exige nomes de coluna específicos)
  3. prévia com validação linha a linha (CPF, e-mail, campos obrigatórios)
  4. confirmação — linhas com problema são ignoradas e listadas no resultado, sem travar
     o restante
  5. ao final, baixa um CSV com nome/CPF/e-mail/senha temporária de cada investidor novo
     (para disparo em lotes — o envio automático por e-mail entra no módulo de
     atualizações/engajamento)
- `/admin/unidades/[id]` — dossiê da unidade: investidores vinculados, histórico
  (timeline) e campo pra adicionar apontamentos; status da unidade editável
  (regularizado / troca de titularidade / distrato)
- Toda unidade carrega um `HistoricoUnidade` — criada automaticamente no cadastro
  (manual ou importação) e por qualquer apontamento adicionado depois

### Testando

Depois do `db:seed`, use:
- Funcionário: `admin@calper.com.br` / `Calper@123`

A importação em massa aceita apenas **CSV** por enquanto (exporte do Excel/Google
Sheets como CSV antes de subir).

## Botão com spinner embutido + força de senha

- `src/lib/components/SubmitButton.svelte` — botão reutilizável: ao carregar, o texto
  some (fade) e a logo circular gira no centro, com o fundo do botão passando a branco
  com sombra suave. Em uso nos logins (investidor e funcionário), primeiro acesso,
  cadastro/importação de unidades e apontamento do dossiê.
- `src/lib/password.js` — avaliação de força de senha (isomórfico): 5 requisitos
  (8+ caracteres, maiúscula, minúscula, número, especial). Nível mínimo aceito pelo
  sistema é **forte** (4 de 5 requisitos) — reforçado tanto no client (tempo real)
  quanto no servidor (`/primeiro-acesso`), então não dá pra burlar desligando o JS.
- `src/lib/components/PasswordStrength.svelte` — barra de força + checklist com check
  verde em tempo real por requisito cumprido.
- `src/lib/components/AvisoSutil.svelte` — aviso inline (não é `alert()`), usado quando
  a senha não atinge o nível mínimo ou as senhas não coincidem.

## Loading spinner

Overlay global (`src/lib/components/LoadingOverlay.svelte`) com a logo circular
(`favicon.png`) girando — aparece automaticamente durante qualquer navegação
(ex: depois de um redirect de login) e também pode ser ligado manualmente em
formulários com `use:enhance={comLoading}` (de `$lib/stores/loading.js`), pra
cobrir o intervalo entre o clique e a resposta do servidor mesmo quando não
há navegação (ex: erro de senha). Já aplicado nos logins do investidor e do
funcionário.

### Próximo módulo
Agendamento (os 5 tipos de evento, regras de bloqueio, upload de documento, QR Code).
