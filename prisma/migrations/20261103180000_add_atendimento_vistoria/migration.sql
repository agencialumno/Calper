-- Atendimento da vistoria (Bloco 3): colunas novas e nulas, sem mexer em dados existentes.
ALTER TABLE "Agendamento" ADD COLUMN "vistoriaPresentes" JSONB;
ALTER TABLE "Agendamento" ADD COLUMN "vistoriaResultado" TEXT;
ALTER TABLE "Agendamento" ADD COLUMN "vistoriaReparos" TEXT;
ALTER TABLE "Agendamento" ADD COLUMN "vistoriaTelefoneRetorno" TEXT;
ALTER TABLE "Agendamento" ADD COLUMN "vistoriaConcluidaEm" TIMESTAMP(3);
