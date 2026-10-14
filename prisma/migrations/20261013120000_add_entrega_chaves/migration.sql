-- AlterTable
ALTER TABLE "Unidade" ADD COLUMN     "statusPagamento" TEXT NOT NULL DEFAULT 'pendente',
ADD COLUMN     "financiado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "grupoFinanciamento" TEXT,
ADD COLUMN     "vistoriaAprovada" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "escrituraRegistrada" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "quartos" INTEGER;

-- AlterTable
ALTER TABLE "Agendamento" ADD COLUMN     "nomeCompareceu" TEXT,
ADD COLUMN     "cpfCompareceu" TEXT,
ADD COLUMN     "telefoneCompareceu" TEXT,
ADD COLUMN     "emailCompareceu" TEXT,
ADD COLUMN     "ehProprietario" BOOLEAN,
ADD COLUMN     "procuracaoBase64" TEXT;
