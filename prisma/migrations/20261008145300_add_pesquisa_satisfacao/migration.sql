-- CreateTable
CREATE TABLE "PesquisaSatisfacao" (
    "id" TEXT NOT NULL,
    "agendamentoId" TEXT NOT NULL,
    "educacaoFuncionarios" TEXT NOT NULL,
    "organizacaoLimpeza" TEXT NOT NULL,
    "expectativasAndamento" TEXT NOT NULL,
    "clarezaInformacoes" TEXT NOT NULL,
    "acabamentoObra" TEXT NOT NULL,
    "atendidoNoHorario" BOOLEAN NOT NULL,
    "indicariaCalper" BOOLEAN NOT NULL,
    "pontosFortes" TEXT,
    "oportunidadesMelhoria" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PesquisaSatisfacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PesquisaSatisfacao_agendamentoId_key" ON "PesquisaSatisfacao"("agendamentoId");

-- AddForeignKey
ALTER TABLE "PesquisaSatisfacao" ADD CONSTRAINT "PesquisaSatisfacao_agendamentoId_fkey" FOREIGN KEY ("agendamentoId") REFERENCES "Agendamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
