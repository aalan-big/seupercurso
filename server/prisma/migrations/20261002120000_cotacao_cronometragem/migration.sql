-- Cotacao do servico de cronometragem (so acrescenta: tipo, tabela e uma coluna opcional)
-- CreateEnum
CREATE TYPE "StatusCotacaoCronometragem" AS ENUM ('SOLICITADA', 'ORCADA', 'ACEITA', 'RECUSADA', 'CANCELADA', 'PAGA', 'CONCLUIDA');

-- AlterTable
ALTER TABLE "ConfiguracaoPlataforma" ADD COLUMN     "dadosPagamentoCronometragem" TEXT;

-- CreateTable
CREATE TABLE "CotacaoCronometragem" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "eventoId" UUID NOT NULL,
    "organizadorId" UUID NOT NULL,
    "status" "StatusCotacaoCronometragem" NOT NULL DEFAULT 'SOLICITADA',
    "servicos" TEXT[],
    "atletasEstimados" INTEGER,
    "pontosPassagem" INTEGER,
    "observacoes" TEXT,
    "valor" DECIMAL(10,2),
    "descricaoProposta" TEXT,
    "propostaValidaAte" TIMESTAMP(3),
    "pagamentoAte" TIMESTAMP(3),
    "propostaEnviadaEm" TIMESTAMP(3),
    "aceitaEm" TIMESTAMP(3),
    "comprovanteUrl" TEXT,
    "comprovanteEnviadoEm" TIMESTAMP(3),
    "pagaEm" TIMESTAMP(3),
    "concluidaEm" TIMESTAMP(3),
    "motivo" TEXT,
    "cronometradoraId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CotacaoCronometragem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CotacaoCronometragem_eventoId_status_idx" ON "CotacaoCronometragem"("eventoId", "status");

-- CreateIndex
CREATE INDEX "CotacaoCronometragem_organizadorId_createdAt_idx" ON "CotacaoCronometragem"("organizadorId", "createdAt");

-- CreateIndex
CREATE INDEX "CotacaoCronometragem_status_idx" ON "CotacaoCronometragem"("status");

-- AddForeignKey
ALTER TABLE "CotacaoCronometragem" ADD CONSTRAINT "CotacaoCronometragem_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "Evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CotacaoCronometragem" ADD CONSTRAINT "CotacaoCronometragem_organizadorId_fkey" FOREIGN KEY ("organizadorId") REFERENCES "Organizador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CotacaoCronometragem" ADD CONSTRAINT "CotacaoCronometragem_cronometradoraId_fkey" FOREIGN KEY ("cronometradoraId") REFERENCES "Cronometradora"("id") ON DELETE SET NULL ON UPDATE CASCADE;

