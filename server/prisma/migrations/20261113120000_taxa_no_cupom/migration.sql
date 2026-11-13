-- Taxa do site tambem no cupom (so acrescenta colunas; tudo comeca desligado)
-- AlterTable Cupom: cortesia sem taxa, liberada so pelo admin
ALTER TABLE "Cupom" ADD COLUMN IF NOT EXISTS "cortesiaSemTaxa" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable Pagamento: cobranca so da taxa, feita na conta da plataforma
ALTER TABLE "Pagamento" ADD COLUMN IF NOT EXISTS "naContaDaPlataforma" BOOLEAN NOT NULL DEFAULT false;
