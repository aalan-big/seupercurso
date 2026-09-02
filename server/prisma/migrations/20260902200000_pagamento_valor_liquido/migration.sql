-- O painel do organizador mostrava comissao e liquido calculados por nos, que
-- desconhecem a tarifa do gateway, divergindo do saldo real da subconta.
-- Passamos a guardar o valor liquido e a tarifa informados pelo Asaas.
ALTER TABLE "Pagamento" ADD COLUMN IF NOT EXISTS "valorLiquido" DECIMAL(10,2);
ALTER TABLE "Pagamento" ADD COLUMN IF NOT EXISTS "taxaGateway" DECIMAL(10,2);
