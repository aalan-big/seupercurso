-- O Asaas exige a renda (PF) ou o faturamento mensal (PJ) em POST /accounts.
-- Sem esse dado a criacao da subconta falhava, o organizador ficava sem
-- asaasWalletId e o split nunca acontecia.
ALTER TABLE "Organizador" ADD COLUMN IF NOT EXISTS "rendaFaturamentoMensal" DECIMAL(12,2);
