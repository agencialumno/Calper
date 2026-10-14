-- CreateTable
CREATE TABLE "PresencaEntrega" (
    "id" TEXT NOT NULL,
    "agendamentoId" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "vinculo" TEXT NOT NULL,
    "cpf" TEXT,
    "registradoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PresencaEntrega_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PresencaEntrega_agendamentoId_idx" ON "PresencaEntrega"("agendamentoId");

-- CreateIndex
CREATE INDEX "PresencaEntrega_unidadeId_idx" ON "PresencaEntrega"("unidadeId");

-- CreateIndex
CREATE INDEX "PresencaEntrega_createdAt_idx" ON "PresencaEntrega"("createdAt");

-- AddForeignKey
ALTER TABLE "PresencaEntrega" ADD CONSTRAINT "PresencaEntrega_agendamentoId_fkey" FOREIGN KEY ("agendamentoId") REFERENCES "Agendamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresencaEntrega" ADD CONSTRAINT "PresencaEntrega_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
