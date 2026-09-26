-- Usos de cada cupom novo, controlado pelo admin (padrao 1). Cupons ja
-- criados nao mudam.
ALTER TABLE "Evento" ADD COLUMN "usosPorCupom" INTEGER NOT NULL DEFAULT 1;
