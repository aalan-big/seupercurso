-- Licenca do SeuPercurso Mark: limite de notebooks por cronometradora (so acrescenta: uma coluna com padrao e uma tabela nova)
-- AlterTable
ALTER TABLE "Cronometradora" ADD COLUMN     "limiteNotebooks" INTEGER NOT NULL DEFAULT 2;

-- CreateTable
CREATE TABLE "NotebookCronometragem" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cronometradoraId" UUID NOT NULL,
    "maquinaId" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ultimoEmail" TEXT,
    "primeiroUsoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimoUsoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotebookCronometragem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotebookCronometragem_cronometradoraId_idx" ON "NotebookCronometragem"("cronometradoraId");

-- CreateIndex
CREATE UNIQUE INDEX "NotebookCronometragem_cronometradoraId_maquinaId_key" ON "NotebookCronometragem"("cronometradoraId", "maquinaId");

-- AddForeignKey
ALTER TABLE "NotebookCronometragem" ADD CONSTRAINT "NotebookCronometragem_cronometradoraId_fkey" FOREIGN KEY ("cronometradoraId") REFERENCES "Cronometradora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

