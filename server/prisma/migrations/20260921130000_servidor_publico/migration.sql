-- AlterTable Evento
ALTER TABLE "Evento" ADD COLUMN IF NOT EXISTS "permiteServidorPublico" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Evento" ADD COLUMN IF NOT EXISTS "vagasServidorPublico" INTEGER;

-- AlterTable Categoria
ALTER TABLE "Categoria" ADD COLUMN IF NOT EXISTS "servidorPublico" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable Inscricao
ALTER TABLE "Inscricao" ADD COLUMN IF NOT EXISTS "isServidorPublico" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Inscricao" ADD COLUMN IF NOT EXISTS "matriculaServidor" TEXT;

-- CreateTable ServidorPublico
CREATE TABLE IF NOT EXISTS "ServidorPublico" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "eventoId" UUID NOT NULL,
    "categoriaId" UUID,
    "cpf" TEXT NOT NULL,
    "matricula" TEXT NOT NULL,
    "nome" TEXT,
    "orgao" TEXT,
    "inscricaoId" UUID,
    "utilizadoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServidorPublico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ServidorPublico_inscricaoId_key" ON "ServidorPublico"("inscricaoId");
CREATE UNIQUE INDEX IF NOT EXISTS "ServidorPublico_eventoId_cpf_key" ON "ServidorPublico"("eventoId", "cpf");
CREATE INDEX IF NOT EXISTS "ServidorPublico_eventoId_matricula_idx" ON "ServidorPublico"("eventoId", "matricula");
CREATE INDEX IF NOT EXISTS "ServidorPublico_eventoId_cpf_idx" ON "ServidorPublico"("eventoId", "cpf");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ServidorPublico_eventoId_fkey'
    ) THEN
        ALTER TABLE "ServidorPublico" ADD CONSTRAINT "ServidorPublico_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "Evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ServidorPublico_categoriaId_fkey'
    ) THEN
        ALTER TABLE "ServidorPublico" ADD CONSTRAINT "ServidorPublico_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ServidorPublico_inscricaoId_fkey'
    ) THEN
        ALTER TABLE "ServidorPublico" ADD CONSTRAINT "ServidorPublico_inscricaoId_fkey" FOREIGN KEY ("inscricaoId") REFERENCES "Inscricao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
