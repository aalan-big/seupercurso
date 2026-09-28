-- Desconto PCD, igual ao do idoso. So acrescenta colunas: desligado em todos
-- os eventos e nenhuma inscricao existente muda.

-- AlterTable
ALTER TABLE "Evento" ADD COLUMN "aplicaDescontoPcd" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "percentualDescontoPcd" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "Inscricao" ADD COLUMN "descontoPcd" BOOLEAN NOT NULL DEFAULT false;
