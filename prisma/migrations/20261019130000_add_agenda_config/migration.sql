-- CreateTable
CREATE TABLE "AgendaConfig" (
    "id" TEXT NOT NULL DEFAULT 'padrao',
    "limitePorHora" INTEGER NOT NULL DEFAULT 4,
    "horarios" JSONB NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgendaConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgendaDia" (
    "id" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "aberto" BOOLEAN NOT NULL DEFAULT true,
    "limitePorHora" INTEGER,
    "limitesPorHorario" JSONB,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgendaDia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgendaDia_data_key" ON "AgendaDia"("data");

-- Valores iniciais: 4 agendamentos por hora e, por enquanto, só os dias 28 a 31 de outubro de 2026.
INSERT INTO "AgendaConfig" ("id", "limitePorHora", "horarios", "atualizadoEm")
VALUES ('padrao', 4, '["09:00","10:00","11:00","13:00","14:00","15:00","16:00"]', CURRENT_TIMESTAMP);

INSERT INTO "AgendaDia" ("id", "data", "aberto", "atualizadoEm") VALUES
  ('agenda-2026-10-28', '2026-10-28', true, CURRENT_TIMESTAMP),
  ('agenda-2026-10-29', '2026-10-29', true, CURRENT_TIMESTAMP),
  ('agenda-2026-10-30', '2026-10-30', true, CURRENT_TIMESTAMP),
  ('agenda-2026-10-31', '2026-10-31', true, CURRENT_TIMESTAMP);
