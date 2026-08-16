-- AlterEnum
ALTER TYPE "StatusEvento" ADD VALUE 'AGUARDANDO_APROVACAO';

-- AlterTable
ALTER TABLE "Evento" ADD COLUMN     "motivoRejeicao" TEXT;

-- AlterTable
ALTER TABLE "Organizador" ADD COLUMN     "documentoIdentidadeUrl" TEXT;

-- CreateTable
CREATE TABLE "Admin" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");
