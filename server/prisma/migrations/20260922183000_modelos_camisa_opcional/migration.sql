-- Suporte a Camisa Opcional no Evento e Modelos de Camisa (Frente e Verso)
ALTER TABLE "Evento" ADD COLUMN IF NOT EXISTS "camisaOpcional" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Evento" ADD COLUMN IF NOT EXISTS "valorCamisaOpcional" DECIMAL(10, 2);

CREATE TABLE IF NOT EXISTS "ModeloCamisa" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "eventoId" UUID NOT NULL,
  "nome" TEXT NOT NULL,
  "descricao" TEXT,
  "fotoFrenteUrl" TEXT,
  "fotoVersoUrl" TEXT,
  "ordem" INTEGER NOT NULL DEFAULT 0,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ModeloCamisa_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ModeloCamisa_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "Evento"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ModeloCamisa_eventoId_idx" ON "ModeloCamisa"("eventoId");

ALTER TABLE "Inscricao" ADD COLUMN IF NOT EXISTS "incluiCamisa" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Inscricao" ADD COLUMN IF NOT EXISTS "valorCamisa" DECIMAL(10, 2);
ALTER TABLE "Inscricao" ADD COLUMN IF NOT EXISTS "modeloCamisaId" UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Inscricao_modeloCamisaId_fkey'
  ) THEN
    ALTER TABLE "Inscricao" ADD CONSTRAINT "Inscricao_modeloCamisaId_fkey"
    FOREIGN KEY ("modeloCamisaId") REFERENCES "ModeloCamisa"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
