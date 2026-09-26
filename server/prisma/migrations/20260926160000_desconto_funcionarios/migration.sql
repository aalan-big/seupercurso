-- Desconto para funcionarios da empresa organizadora (separado do servidor
-- publico). So adiciona: evento nasce com o recurso desligado.
-- AlterTable
ALTER TABLE "Evento" ADD COLUMN     "nomeEmpresaFuncionarios" TEXT,
ADD COLUMN     "percentualFuncionarios" DECIMAL(5,2),
ADD COLUMN     "permiteFuncionarios" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "vagasFuncionarios" INTEGER;

-- AlterTable
ALTER TABLE "Inscricao" ADD COLUMN     "isFuncionario" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "matriculaFuncionario" TEXT,
ADD COLUMN     "percentualFuncionario" DECIMAL(5,2);

-- CreateTable
CREATE TABLE "FuncionarioEmpresa" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "eventoId" UUID NOT NULL,
    "cpf" TEXT NOT NULL,
    "matricula" TEXT NOT NULL,
    "nome" TEXT,
    "inscricaoId" UUID,
    "utilizadoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FuncionarioEmpresa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FuncionarioEmpresa_inscricaoId_key" ON "FuncionarioEmpresa"("inscricaoId");

-- CreateIndex
CREATE INDEX "FuncionarioEmpresa_eventoId_matricula_idx" ON "FuncionarioEmpresa"("eventoId", "matricula");

-- CreateIndex
CREATE UNIQUE INDEX "FuncionarioEmpresa_eventoId_cpf_key" ON "FuncionarioEmpresa"("eventoId", "cpf");

-- AddForeignKey
ALTER TABLE "FuncionarioEmpresa" ADD CONSTRAINT "FuncionarioEmpresa_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "Evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuncionarioEmpresa" ADD CONSTRAINT "FuncionarioEmpresa_inscricaoId_fkey" FOREIGN KEY ("inscricaoId") REFERENCES "Inscricao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

