-- Data de expiracao da cobranca (PIX vence em 24h no Asaas). Permite marcar
-- o pagamento como EXPIRADO sem depender de um job externo.
ALTER TABLE "Pagamento" ADD COLUMN IF NOT EXISTS "expiraEm" TIMESTAMP(3);

-- O checkout real agrupa inscricoes em um Pedido, entao o indice unico parcial
-- de "inscricaoId" nao cobria o fluxo em lote. Espelha a mesma garantia para pedidos.
CREATE UNIQUE INDEX IF NOT EXISTS "Pagamento_pedidoId_aprovado_key"
  ON "Pagamento" ("pedidoId")
  WHERE "status" = 'APROVADO';

-- Saques do organizador: sem esse registro nao era possivel descontar o que ja
-- foi retirado, e o mesmo saldo podia ser sacado repetidas vezes.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StatusSaque') THEN
    CREATE TYPE "StatusSaque" AS ENUM ('PROCESSANDO', 'CONCLUIDO', 'FALHOU');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "Saque" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizadorId" UUID NOT NULL,
  "valor" DECIMAL(10,2) NOT NULL,
  "status" "StatusSaque" NOT NULL DEFAULT 'PROCESSANDO',
  "chaveDestino" TEXT NOT NULL,
  "transferId" TEXT,
  "motivoFalha" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Saque_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Saque_transferId_key" ON "Saque" ("transferId");
CREATE INDEX IF NOT EXISTS "Saque_organizadorId_status_idx" ON "Saque" ("organizadorId", "status");

ALTER TABLE "Saque" DROP CONSTRAINT IF EXISTS "Saque_organizadorId_fkey";
ALTER TABLE "Saque" ADD CONSTRAINT "Saque_organizadorId_fkey"
  FOREIGN KEY ("organizadorId") REFERENCES "Organizador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
