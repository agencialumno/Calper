-- CreateTable
CREATE TABLE "AgendaDiaVistoria" (
    "id" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "aberto" BOOLEAN NOT NULL DEFAULT true,
    "limitePorHora" INTEGER,
    "limitesPorHorario" JSONB,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgendaDiaVistoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgendaDiaVistoria_data_key" ON "AgendaDiaVistoria"("data");
