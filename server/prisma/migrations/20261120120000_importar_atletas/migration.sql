-- Importar atletas vendidos em outro site (so acrescenta; tudo comeca
-- desligado e nenhuma inscricao, lote ou evento existente muda)

-- AlterTable Evento: admin libera evento a evento
ALTER TABLE "Evento" ADD COLUMN IF NOT EXISTS "importacaoLiberada" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable Lote: lote interno dos importados (nunca vendido)
ALTER TABLE "Lote" ADD COLUMN IF NOT EXISTS "somenteImportacao" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable Inscricao
ALTER TABLE "Inscricao" ADD COLUMN IF NOT EXISTS "atletaEmail" TEXT;
ALTER TABLE "Inscricao" ADD COLUMN IF NOT EXISTS "importacaoId" UUID;

-- CreateTable ImportacaoAtletas
CREATE TABLE IF NOT EXISTS "ImportacaoAtletas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "eventoId" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "siteOrigem" TEXT NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "totalAtletas" INTEGER NOT NULL,
    "desfeitaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportacaoAtletas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ImportacaoAtletas_eventoId_idx" ON "ImportacaoAtletas"("eventoId");
CREATE INDEX IF NOT EXISTS "Inscricao_importacaoId_idx" ON "Inscricao"("importacaoId");

-- AddForeignKey
ALTER TABLE "ImportacaoAtletas" ADD CONSTRAINT "ImportacaoAtletas_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "Evento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Inscricao" ADD CONSTRAINT "Inscricao_importacaoId_fkey" FOREIGN KEY ("importacaoId") REFERENCES "ImportacaoAtletas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
