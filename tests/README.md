# Testes de regressão

Rode **antes de qualquer novo ajuste** (e antes de cada deploy): `bun run test` e `bun run test:e2e`.

## O que existe

| Camada | Comando | Duração | Cobre |
|---|---|---|---|
| Unidade (vitest) | `bun run test` | ~3 s | regras de agenda (limite por hora/dia/horário), validação de CPF/e-mail, âncoras e caixa de assinatura, linhas de assinatura dos documentos (M1/cônjuge), zip, CSV, filtros de "quem agendou", guarda de `/admin` (sessão e perfil) |
| Ponta a ponta (Playwright) | `bun run test:e2e` | ~10 min | agendamento público (proprietário, procurador, PDF/DOC/DOCX × imagem, lotação "(indisponível)", unidade some da lista), guarda sem login, perfil atendimento, cadastro da equipe, "quem agendou" + CSV, presença recebeu × falta + CSV, exportações existentes, zip por unidade, foto da procuração → PDF |

## Banco de teste

Os testes de ponta a ponta usam um **schema separado** (`calper_test`) na mesma instância do Postgres. O banco é esvaziado e recriado a cada execução.

1. Crie o arquivo `.env.test` (ignorado pelo git) com:
   `DATABASE_URL_TESTE="<mesma URL de DATABASE_URL, acrescida de &schema=calper_test>"`
2. Crie as tabelas uma vez: `DATABASE_URL="<a URL acima>" npx prisma migrate deploy`
3. Depois de **novas migrações**, repita o passo 2.

Trava de segurança: `tests/preparar-banco-teste.js` recusa rodar se a URL não apontar para `schema=calper_test`.

## Fora desta fase (fica para depois)

O fluxo de assinatura com o DocuSign (Calper assina termo e checklist, envelope único, e-mail ao cliente/cônjuge) **não** é automatizado. Roteiro manual, com dados de teste identificáveis (e-mails `@example.com`, sem CC):

1. Criar um agendamento de teste em unidade livre; no atendimento, passo 2: confirmar quem retira e cadastrar o cônjuge.
2. Passo 3 (termo): "Cliente: ler o documento" → "Cliente leu — assinar pela Calper" → assinar no iframe → conferir "Calper assinou o termo" e que o cliente ainda **não** recebeu e-mail.
3. Passo 4 (checklist): ler → assinar → conferir "Calper assinou — aguardando o cliente", com cliente e cônjuge listados e um único e-mail enviado.
4. "Verificar agora no DocuSign" responde sem erro.
5. Baixar o PDF assinado: caixas centralizadas sobre a linha, sem sobrepor o nome de cima.
6. Limpeza: anular o envelope no DocuSign e apagar o agendamento de teste.

## Ordem dos testes e perfis de teste

- Os testes rodam em ordem alfabética de arquivo e compartilham o mesmo banco de teste. O de importação **"Sobrescrever"**
  apaga unidades e agendamentos de propósito, por isso o arquivo se chama `zz-importacao.spec.js`: tem que rodar por último.
- Usuários de teste (criados em `tests/preparar-banco-teste.js`): `ADMIN`, `SUPERVISOR` e `COLABORADOR` (os três perfis).
- As unidades 106 e 107 do banco de teste já trazem os dados da base consolidada (vistoria, escritura, datas, valores): são as que
  os testes de etiquetas, "ver mais" e edição de status usam. A planilha sintética `tests/fixtures/base-consolidada-teste.xlsx`
  imita o layout da planilha nova **sem dados reais** (planilhas de verdade nunca entram no git).

## Ambiente de teste local / preview (vistoria e entrega de chaves)

Passo a passo, sempre no schema de teste (nunca produção):

1. `.env.test` com `DATABASE_URL_TESTE="<URL do banco>&schema=calper_test"` (para um preview, use `schema=calper_preview` numa URL separada).
2. `DATABASE_URL="<essa URL>" npx prisma migrate deploy` (cria as tabelas, inclusive `AgendaDiaVistoria` e `Agendamento.vistoriaNumero`).
3. Unidades de exemplo dos Blocos 2 e 3: `node scripts/popular-unidades-exemplo.js` (simulação) e depois `--aplicar`. Só cria; recusa qualquer schema que não seja `calper_test`/`calper_preview`.
4. Na equipe, abra dias da vistoria em **Agenda vistoria** (começa vazia); a entrega usa a **Agenda** de sempre.
5. Páginas públicas: `/agendamento` (escolha), `/agendar-entrega-chaves` (Bloco 2; o Bloco 3 mostra o erro) e `/agendar-vistoria` (só Bloco 3).
6. Variáveis do preview: as mesmas do `.env.example` (`DATABASE_URL` apontando para o schema de preview e as chaves do DocuSign **demo**). Nunca use a conta de produção do DocuSign em teste.
