-- Evento 100% gratuito liberado pelo admin (so acrescenta colunas; tudo
-- comeca desligado, nenhum evento existente muda)
-- AlterTable Evento
ALTER TABLE "Evento" ADD COLUMN IF NOT EXISTS "eventoGratuito" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Evento" ADD COLUMN IF NOT EXISTS "vagasEventoGratuito" INTEGER;

-- AlterTable Inscricao
ALTER TABLE "Inscricao" ADD COLUMN IF NOT EXISTS "isGratuitoEvento" BOOLEAN NOT NULL DEFAULT false;
