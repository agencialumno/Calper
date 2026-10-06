-- CreateTable
CREATE TABLE "Empreendimento" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "estagioAtual" TEXT NOT NULL DEFAULT 'Início da Jornada',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Empreendimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unidade" (
    "id" TEXT NOT NULL,
    "empreendimentoId" TEXT NOT NULL,
    "bloco" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'regularizado',
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Unidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoricoUnidade" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "criadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricoUnidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Investidor" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "primeiroAcesso" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Investidor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnidadeInvestidor" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "investidorId" TEXT NOT NULL,
    "email" TEXT NOT NULL,

    CONSTRAINT "UnidadeInvestidor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sessao" (
    "id" TEXT NOT NULL,
    "investidorId" TEXT NOT NULL,
    "unidadeId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sessao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Funcionario" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "perfil" TEXT NOT NULL DEFAULT 'atendimento',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Funcionario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessaoFuncionario" (
    "id" TEXT NOT NULL,
    "funcionarioId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessaoFuncionario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportacaoLote" (
    "id" TEXT NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "totalLinhas" INTEGER NOT NULL,
    "unidadesCriadas" INTEGER NOT NULL,
    "investidoresCriados" INTEGER NOT NULL,
    "erros" JSONB,
    "credenciais" JSONB,
    "criadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportacaoLote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Unidade_empreendimentoId_bloco_numero_key" ON "Unidade"("empreendimentoId", "bloco", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "Investidor_cpf_key" ON "Investidor"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "UnidadeInvestidor_unidadeId_investidorId_key" ON "UnidadeInvestidor"("unidadeId", "investidorId");

-- CreateIndex
CREATE UNIQUE INDEX "Funcionario_email_key" ON "Funcionario"("email");

-- AddForeignKey
ALTER TABLE "Unidade" ADD CONSTRAINT "Unidade_empreendimentoId_fkey" FOREIGN KEY ("empreendimentoId") REFERENCES "Empreendimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricoUnidade" ADD CONSTRAINT "HistoricoUnidade_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnidadeInvestidor" ADD CONSTRAINT "UnidadeInvestidor_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnidadeInvestidor" ADD CONSTRAINT "UnidadeInvestidor_investidorId_fkey" FOREIGN KEY ("investidorId") REFERENCES "Investidor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sessao" ADD CONSTRAINT "Sessao_investidorId_fkey" FOREIGN KEY ("investidorId") REFERENCES "Investidor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessaoFuncionario" ADD CONSTRAINT "SessaoFuncionario_funcionarioId_fkey" FOREIGN KEY ("funcionarioId") REFERENCES "Funcionario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportacaoLote" ADD CONSTRAINT "ImportacaoLote_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Funcionario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
