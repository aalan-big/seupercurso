-- AlterTable
ALTER TABLE "Evento" ADD COLUMN     "aplicaDescontoIdoso" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "percentualDescontoIdoso" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "Inscricao" ADD COLUMN     "cupomId" UUID;

-- CreateTable
CREATE TABLE "Cupom" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "eventoId" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "percentualDesconto" DECIMAL(5,2) NOT NULL,
    "quantidadeMaxima" INTEGER,
    "usosAtuais" INTEGER NOT NULL DEFAULT 0,
    "validoAte" TIMESTAMP(3),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cupom_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cupom_eventoId_codigo_key" ON "Cupom"("eventoId", "codigo");

-- AddForeignKey
ALTER TABLE "Cupom" ADD CONSTRAINT "Cupom_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "Evento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscricao" ADD CONSTRAINT "Inscricao_cupomId_fkey" FOREIGN KEY ("cupomId") REFERENCES "Cupom"("id") ON DELETE SET NULL ON UPDATE CASCADE;
