ALTER TABLE "Agendamento" ADD COLUMN "canceladoPorId" TEXT,
ADD COLUMN "canceladoEm" TIMESTAMP(3),
ADD COLUMN "motivoCancelamento" TEXT,
ADD COLUMN "unidadeOriginalId" TEXT;
