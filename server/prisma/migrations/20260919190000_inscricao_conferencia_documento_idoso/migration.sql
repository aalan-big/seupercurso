-- O documento do idoso ficava so guardado; nao havia como o organizador
-- registrar que conferiu, nem filtrar o que falta conferir. Passa a ter um
-- status por inscricao (PENDENTE ao nascer com documento), motivo da recusa e
-- quando foi revisado. A venda nao espera pela conferencia.
CREATE TYPE "StatusDocumentoIdoso" AS ENUM ('PENDENTE', 'APROVADO', 'REJEITADO');

ALTER TABLE "Inscricao"
  ADD COLUMN IF NOT EXISTS "documentoIdosoStatus" "StatusDocumentoIdoso",
  ADD COLUMN IF NOT EXISTS "documentoIdosoMotivo" TEXT,
  ADD COLUMN IF NOT EXISTS "documentoIdosoRevisadoEm" TIMESTAMP(3);

-- Quem ja mandou documento antes desta migracao entra na fila de conferencia.
UPDATE "Inscricao"
SET "documentoIdosoStatus" = 'PENDENTE'
WHERE "documentoIdosoUrl" IS NOT NULL
  AND "documentoIdosoStatus" IS NULL;
