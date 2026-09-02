-- O Asaas exige e-mail unico por conta. Quem ja possui conta la (inclusive a
-- propria conta-mae da plataforma) nao consegue abrir a subconta com o mesmo
-- e-mail de login, entao passa a poder informar um e-mail dedicado.
ALTER TABLE "Organizador" ADD COLUMN IF NOT EXISTS "emailRecebimento" TEXT;
