-- AlterTable
ALTER TABLE "Agendamento" ADD COLUMN     "lembreteEnviado" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Notificacao" (
    "id" TEXT NOT NULL,
    "destinatarioTipo" TEXT NOT NULL,
    "investidorId" TEXT,
    "funcionarioId" TEXT,
    "titulo" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "link" TEXT,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notificacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notificacao_investidorId_lida_idx" ON "Notificacao"("investidorId", "lida");

-- CreateIndex
CREATE INDEX "Notificacao_funcionarioId_lida_idx" ON "Notificacao"("funcionarioId", "lida");
