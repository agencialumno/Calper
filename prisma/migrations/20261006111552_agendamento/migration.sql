-- CreateTable
CREATE TABLE "TipoEvento" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "exigeDocumento" BOOLEAN NOT NULL DEFAULT false,
    "limitePessoas" INTEGER NOT NULL DEFAULT 4,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TipoEvento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agendamento" (
    "id" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "tipoEventoId" TEXT NOT NULL,
    "investidorId" TEXT NOT NULL,
    "dataHora" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'confirmado',
    "qrToken" TEXT NOT NULL,
    "documentoBase64" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Agendamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Acompanhante" (
    "id" TEXT NOT NULL,
    "agendamentoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,

    CONSTRAINT "Acompanhante_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TipoEvento_slug_key" ON "TipoEvento"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Agendamento_qrToken_key" ON "Agendamento"("qrToken");

-- CreateIndex
CREATE INDEX "Agendamento_unidadeId_tipoEventoId_status_idx" ON "Agendamento"("unidadeId", "tipoEventoId", "status");

-- AddForeignKey
ALTER TABLE "Agendamento" ADD CONSTRAINT "Agendamento_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "Unidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agendamento" ADD CONSTRAINT "Agendamento_tipoEventoId_fkey" FOREIGN KEY ("tipoEventoId") REFERENCES "TipoEvento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agendamento" ADD CONSTRAINT "Agendamento_investidorId_fkey" FOREIGN KEY ("investidorId") REFERENCES "Investidor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Acompanhante" ADD CONSTRAINT "Acompanhante_agendamentoId_fkey" FOREIGN KEY ("agendamentoId") REFERENCES "Agendamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
