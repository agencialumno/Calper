-- AlterTable
ALTER TABLE "Agendamento" ADD COLUMN     "retiranteNome" TEXT,
ADD COLUMN     "retiranteEmail" TEXT,
ADD COLUMN     "retiranteCpf" TEXT;

-- AlterTable (campo substituído por statusQuitacao)
ALTER TABLE "Unidade" DROP COLUMN "statusPagamento";
