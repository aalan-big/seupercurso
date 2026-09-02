-- Troca de CPF/CNPJ passa a exigir documento e aprovacao do admin, porque esse
-- dado define para qual conta o organizador consegue sacar.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StatusSolicitacaoDocumento') THEN
    CREATE TYPE "StatusSolicitacaoDocumento" AS ENUM ('PENDENTE', 'APROVADA', 'REJEITADA');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TipoDocumentoTitular') THEN
    CREATE TYPE "TipoDocumentoTitular" AS ENUM ('CPF', 'CNPJ');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "SolicitacaoAlteracaoDocumento" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "clienteId" UUID NOT NULL,
  "tipo" "TipoDocumentoTitular" NOT NULL,
  "documentoAtual" TEXT NOT NULL,
  "documentoNovo" TEXT NOT NULL,
  "arquivoUrl" TEXT NOT NULL,
  "motivo" TEXT,
  "status" "StatusSolicitacaoDocumento" NOT NULL DEFAULT 'PENDENTE',
  "motivoRejeicao" TEXT,
  "revisadoEm" TIMESTAMP(3),
  "revisadoPorId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SolicitacaoAlteracaoDocumento_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SolicitacaoAlteracaoDocumento_clienteId_status_idx"
  ON "SolicitacaoAlteracaoDocumento" ("clienteId", "status");
CREATE INDEX IF NOT EXISTS "SolicitacaoAlteracaoDocumento_status_idx"
  ON "SolicitacaoAlteracaoDocumento" ("status");

ALTER TABLE "SolicitacaoAlteracaoDocumento"
  DROP CONSTRAINT IF EXISTS "SolicitacaoAlteracaoDocumento_clienteId_fkey";
ALTER TABLE "SolicitacaoAlteracaoDocumento"
  ADD CONSTRAINT "SolicitacaoAlteracaoDocumento_clienteId_fkey"
  FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
