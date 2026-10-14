-- AlterTable
ALTER TABLE "Empreendimento" ADD COLUMN     "bannerImagemBase64" TEXT,
ADD COLUMN     "dataLancamento" TIMESTAMP(3),
ADD COLUMN     "dataEntregaPrevista" TIMESTAMP(3),
ADD COLUMN     "progressoPercentual" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "jornadaTitulo" TEXT,
ADD COLUMN     "jornadaConteudo" TEXT;
