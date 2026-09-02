-- Migracao do gateway: Asaas -> Mercado Pago.
-- O id da cobranca deixa de ser especifico de um gateway.
ALTER TABLE "Pagamento" RENAME COLUMN "asaasPaymentId" TO "gatewayPaymentId";
ALTER INDEX IF EXISTS "Pagamento_asaasPaymentId_key" RENAME TO "Pagamento_gatewayPaymentId_key";

-- Conexao OAuth do organizador com a conta Mercado Pago dele. Diferente do
-- Asaas, nao criamos conta para ninguem: o organizador autoriza a nossa
-- aplicacao e o dinheiro cai direto na conta dele.
ALTER TABLE "Organizador" ADD COLUMN IF NOT EXISTS "mpUserId" TEXT;
ALTER TABLE "Organizador" ADD COLUMN IF NOT EXISTS "mpAccessToken" TEXT;
ALTER TABLE "Organizador" ADD COLUMN IF NOT EXISTS "mpRefreshToken" TEXT;
ALTER TABLE "Organizador" ADD COLUMN IF NOT EXISTS "mpTokenExpiraEm" TIMESTAMP(3);
ALTER TABLE "Organizador" ADD COLUMN IF NOT EXISTS "mpConectadoEm" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "Organizador_mpUserId_key" ON "Organizador" ("mpUserId");

-- As colunas asaas* ficam no banco para consulta historica das cobrancas
-- antigas, mas nenhum codigo escreve ou le mais elas.
