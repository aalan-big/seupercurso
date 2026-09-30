-- CreateEnum
CREATE TYPE "StatusCronometradora" AS ENUM ('ATIVA', 'BLOQUEADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "PapelCronometragem" AS ENUM ('ADMIN', 'OPERADOR');

-- CreateEnum
CREATE TYPE "StatusSolicitacaoCronometragem" AS ENUM ('PENDENTE', 'APROVADA', 'RECUSADA', 'REVOGADA', 'EXPIRADA');

-- CreateEnum
CREATE TYPE "TipoPontoCronometragem" AS ENUM ('LARGADA', 'PARCIAL', 'CHEGADA', 'PORTICO_UNICO');

-- CreateEnum
CREATE TYPE "OrigemPassagemCronometragem" AS ENUM ('RFID', 'MANUAL');

-- CreateTable
CREATE TABLE "Cronometradora" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nome" TEXT NOT NULL,
    "documento" TEXT,
    "plano" TEXT NOT NULL DEFAULT 'Cronometragem anual',
    "assinaturaValidaAte" TIMESTAMP(3) NOT NULL,
    "status" "StatusCronometradora" NOT NULL DEFAULT 'ATIVA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cronometradora_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsuarioCronometragem" (
    "usuarioId" UUID NOT NULL,
    "cronometradoraId" UUID NOT NULL,
    "papel" "PapelCronometragem" NOT NULL DEFAULT 'OPERADOR',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsuarioCronometragem_pkey" PRIMARY KEY ("usuarioId")
);

-- CreateTable
CREATE TABLE "SolicitacaoCronometragem" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cronometradoraId" UUID NOT NULL,
    "eventoId" UUID NOT NULL,
    "status" "StatusSolicitacaoCronometragem" NOT NULL DEFAULT 'PENDENTE',
    "mensagem" TEXT NOT NULL,
    "resposta" TEXT,
    "validaAte" TIMESTAMP(3),
    "respondidaEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SolicitacaoCronometragem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PassagemCronometragem" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "notebookId" TEXT NOT NULL,
    "idLocal" INTEGER NOT NULL,
    "cronometradoraId" UUID NOT NULL,
    "eventoId" UUID NOT NULL,
    "atletaId" TEXT,
    "numeroPeito" INTEGER,
    "tagEpc" TEXT,
    "passagemEm" TIMESTAMP(3) NOT NULL,
    "ponto" TEXT NOT NULL,
    "pontoTipo" "TipoPontoCronometragem" NOT NULL,
    "origem" "OrigemPassagemCronometragem" NOT NULL DEFAULT 'RFID',
    "invalidada" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PassagemCronometragem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChipsCronometragem" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "eventoId" UUID NOT NULL,
    "numeroPeito" INTEGER NOT NULL,
    "tagEpc" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChipsCronometragem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditoriaCronometragem" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuarioId" UUID NOT NULL,
    "cronometradoraId" UUID NOT NULL,
    "eventoId" UUID,
    "acao" TEXT NOT NULL,
    "detalhe" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditoriaCronometragem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UsuarioCronometragem_cronometradoraId_idx" ON "UsuarioCronometragem"("cronometradoraId");

-- CreateIndex
CREATE INDEX "SolicitacaoCronometragem_cronometradoraId_eventoId_idx" ON "SolicitacaoCronometragem"("cronometradoraId", "eventoId");

-- CreateIndex
CREATE INDEX "SolicitacaoCronometragem_eventoId_status_idx" ON "SolicitacaoCronometragem"("eventoId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PassagemCronometragem_notebookId_idLocal_eventoId_key" ON "PassagemCronometragem"("notebookId", "idLocal", "eventoId");

-- CreateIndex
CREATE INDEX "PassagemCronometragem_eventoId_idx" ON "PassagemCronometragem"("eventoId");

-- CreateIndex
CREATE INDEX "PassagemCronometragem_cronometradoraId_idx" ON "PassagemCronometragem"("cronometradoraId");

-- CreateIndex
CREATE UNIQUE INDEX "ChipsCronometragem_eventoId_numeroPeito_key" ON "ChipsCronometragem"("eventoId", "numeroPeito");

-- CreateIndex
CREATE UNIQUE INDEX "ChipsCronometragem_eventoId_tagEpc_key" ON "ChipsCronometragem"("eventoId", "tagEpc");

-- CreateIndex
CREATE INDEX "ChipsCronometragem_eventoId_idx" ON "ChipsCronometragem"("eventoId");

-- CreateIndex
CREATE INDEX "AuditoriaCronometragem_cronometradoraId_idx" ON "AuditoriaCronometragem"("cronometradoraId");

-- CreateIndex
CREATE INDEX "AuditoriaCronometragem_eventoId_idx" ON "AuditoriaCronometragem"("eventoId");

-- AddForeignKey
ALTER TABLE "UsuarioCronometragem" ADD CONSTRAINT "UsuarioCronometragem_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioCronometragem" ADD CONSTRAINT "UsuarioCronometragem_cronometradoraId_fkey" FOREIGN KEY ("cronometradoraId") REFERENCES "Cronometradora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitacaoCronometragem" ADD CONSTRAINT "SolicitacaoCronometragem_cronometradoraId_fkey" FOREIGN KEY ("cronometradoraId") REFERENCES "Cronometradora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitacaoCronometragem" ADD CONSTRAINT "SolicitacaoCronometragem_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "Evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassagemCronometragem" ADD CONSTRAINT "PassagemCronometragem_cronometradoraId_fkey" FOREIGN KEY ("cronometradoraId") REFERENCES "Cronometradora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassagemCronometragem" ADD CONSTRAINT "PassagemCronometragem_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "Evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChipsCronometragem" ADD CONSTRAINT "ChipsCronometragem_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "Evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditoriaCronometragem" ADD CONSTRAINT "AuditoriaCronometragem_cronometradoraId_fkey" FOREIGN KEY ("cronometradoraId") REFERENCES "Cronometradora"("id") ON DELETE CASCADE ON UPDATE CASCADE;
