-- CreateTable
CREATE TABLE "LogAcesso" (
    "id" TEXT NOT NULL,
    "atorTipo" TEXT NOT NULL,
    "investidorId" TEXT,
    "funcionarioId" TEXT,
    "acao" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "entidadeTipo" TEXT,
    "entidadeId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogAcesso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LogAcesso_investidorId_createdAt_idx" ON "LogAcesso"("investidorId", "createdAt");

-- CreateIndex
CREATE INDEX "LogAcesso_funcionarioId_createdAt_idx" ON "LogAcesso"("funcionarioId", "createdAt");

-- CreateIndex
CREATE INDEX "LogAcesso_acao_createdAt_idx" ON "LogAcesso"("acao", "createdAt");

-- CreateIndex
CREATE INDEX "LogAcesso_createdAt_idx" ON "LogAcesso"("createdAt");
