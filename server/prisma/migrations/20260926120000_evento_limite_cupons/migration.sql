-- Limite de cupons por evento, controlado pelo admin (padrao 10)
ALTER TABLE "Evento" ADD COLUMN "limiteCupons" INTEGER NOT NULL DEFAULT 10;
