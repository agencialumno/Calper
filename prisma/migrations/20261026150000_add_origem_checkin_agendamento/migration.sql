ALTER TABLE "Agendamento" ADD COLUMN "origem" TEXT NOT NULL DEFAULT 'agendamento',
ADD COLUMN "checkinEm" TIMESTAMP(3);
