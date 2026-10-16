-- AlterTable
ALTER TABLE "Agendamento" ADD COLUMN     "procuracaoCpf" TEXT;

-- CreateTable
CREATE TABLE "ProcuracaoUnidade" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "agendamentoId" TEXT,
    "nome" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "arquivoBase64" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcuracaoUnidade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProcuracaoUnidade_unidadeId_createdAt_idx" ON "ProcuracaoUnidade"("unidadeId", "createdAt");

-- AddForeignKey
ALTER TABLE "ProcuracaoUnidade" ADD CONSTRAINT "ProcuracaoUnidade_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
