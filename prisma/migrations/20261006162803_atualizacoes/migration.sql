-- CreateTable
CREATE TABLE "AtualizacaoEstagio" (
    "id" TEXT NOT NULL,
    "empreendimentoId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "midiaBase64" TEXT,
    "publicadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AtualizacaoEstagio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailEnviado" (
    "id" TEXT NOT NULL,
    "atualizacaoId" TEXT NOT NULL,
    "investidorId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "enviado" BOOLEAN NOT NULL DEFAULT true,
    "erro" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailEnviado_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AtualizacaoEstagio" ADD CONSTRAINT "AtualizacaoEstagio_empreendimentoId_fkey" FOREIGN KEY ("empreendimentoId") REFERENCES "Empreendimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AtualizacaoEstagio" ADD CONSTRAINT "AtualizacaoEstagio_publicadoPorId_fkey" FOREIGN KEY ("publicadoPorId") REFERENCES "Funcionario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailEnviado" ADD CONSTRAINT "EmailEnviado_atualizacaoId_fkey" FOREIGN KEY ("atualizacaoId") REFERENCES "AtualizacaoEstagio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
