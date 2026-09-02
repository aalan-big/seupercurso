-- O Asaas exige a renda (PF) ou o faturamento mensal (PJ) em POST /accounts.
-- Sem esse dado a criacao da subconta falhava, o organizador ficava sem
-- asaasWalletId e o split nunca acontecia.
ALTER TABLE "Organizador" ADD COLUMN IF NOT EXISTS "rendaFaturamentoMensal" DECIMAL(12,2);

-- O Asaas tambem exige companyType quando a subconta e aberta com CNPJ.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TipoEmpresa') THEN
    CREATE TYPE "TipoEmpresa" AS ENUM ('MEI', 'LIMITED', 'INDIVIDUAL', 'ASSOCIATION');
  END IF;
END
$$;

ALTER TABLE "Organizador" ADD COLUMN IF NOT EXISTS "tipoEmpresa" "TipoEmpresa";
