-- O organizador passa a declarar se o evento entrega camisa. Padrao true para
-- que todo evento ja criado continue pedindo o tamanho na inscricao.
ALTER TABLE "Evento" ADD COLUMN IF NOT EXISTS "possuiCamisa" BOOLEAN NOT NULL DEFAULT true;
