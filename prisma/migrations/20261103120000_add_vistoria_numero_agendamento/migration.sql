-- Aditiva: coluna nova com valor padrao (os agendamentos existentes, todos de entrega de chaves, ficam com 1).
ALTER TABLE "Agendamento" ADD COLUMN "vistoriaNumero" INTEGER NOT NULL DEFAULT 1;
