-- Tipo do evento/esporte, escolhido no formulario do organizador e mostrado
-- no card do site. So acrescenta: todo evento existente fica como CORRIDA
-- (o que o card ja mostrava) e o organizador ajusta os demais.

-- CreateEnum
CREATE TYPE "TipoEsporte" AS ENUM ('CORRIDA', 'TRAIL_RUN', 'CICLISMO', 'MOTOCROSS', 'CAMINHADA', 'TRIATHLON', 'FITNESS', 'OUTROS');

-- AlterTable
ALTER TABLE "Evento" ADD COLUMN "tipoEsporte" "TipoEsporte" NOT NULL DEFAULT 'CORRIDA';
