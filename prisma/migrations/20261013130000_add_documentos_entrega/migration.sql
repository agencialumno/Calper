-- CreateTable
CREATE TABLE "DocumentoTemplate" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "empreendimentoId" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "variaveis" JSONB,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentoTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentoAssinado" (
    "id" TEXT NOT NULL,
    "agendamentoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "pdfBase64" TEXT,
    "docusignEnvelopeId" TEXT NOT NULL,
    "assinadoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentoAssinado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentoTemplate_empreendimentoId_tipo_key" ON "DocumentoTemplate"("empreendimentoId", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentoAssinado_agendamentoId_tipo_key" ON "DocumentoAssinado"("agendamentoId", "tipo");

-- AddForeignKey
ALTER TABLE "DocumentoTemplate" ADD CONSTRAINT "DocumentoTemplate_empreendimentoId_fkey" FOREIGN KEY ("empreendimentoId") REFERENCES "Empreendimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentoAssinado" ADD CONSTRAINT "DocumentoAssinado_agendamentoId_fkey" FOREIGN KEY ("agendamentoId") REFERENCES "Agendamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
