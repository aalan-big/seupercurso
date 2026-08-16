-- AlterTable
ALTER TABLE "Evento" ADD COLUMN     "bannerUrl" TEXT,
ADD COLUMN     "mapaPercursoUrl" TEXT,
ADD COLUMN     "retiradaKitFim" TIMESTAMP(3),
ADD COLUMN     "retiradaKitInicio" TIMESTAMP(3),
ADD COLUMN     "retiradaKitLocal" TEXT,
ADD COLUMN     "termoResponsabilidade" TEXT;
