-- CreateEnum
CREATE TYPE "StatusUsuario" AS ENUM ('ATIVO', 'INATIVO', 'BANIDO');

-- CreateEnum
CREATE TYPE "StatusRegistro" AS ENUM ('ATIVO', 'INATIVO');

-- CreateEnum
CREATE TYPE "Genero" AS ENUM ('MASCULINO', 'FEMININO', 'OUTRO');

-- CreateEnum
CREATE TYPE "GeneroCategoria" AS ENUM ('MASCULINO', 'FEMININO', 'LIVRE');

-- CreateEnum
CREATE TYPE "StatusOrganizador" AS ENUM ('PENDENTE', 'APROVADO', 'REJEITADO', 'SUSPENSO');

-- CreateEnum
CREATE TYPE "StatusEvento" AS ENUM ('RASCUNHO', 'PUBLICADO', 'INSCRICOES_ENCERRADAS', 'CANCELADO', 'FINALIZADO');

-- CreateEnum
CREATE TYPE "StatusInscricao" AS ENUM ('PENDENTE_PAGAMENTO', 'CONFIRMADA', 'CANCELADA', 'EXPIRADA');

-- CreateEnum
CREATE TYPE "MetodoPagamento" AS ENUM ('PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'BOLETO');

-- CreateEnum
CREATE TYPE "StatusPagamento" AS ENUM ('PENDENTE', 'APROVADO', 'RECUSADO', 'ESTORNADO', 'CANCELADO', 'EXPIRADO');

-- CreateEnum
CREATE TYPE "StatusResultado" AS ENUM ('FINALIZADO', 'DNF', 'DNS', 'DESCLASSIFICADO');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "emailVerificado" BOOLEAN NOT NULL DEFAULT false,
    "status" "StatusUsuario" NOT NULL DEFAULT 'ATIVO',
    "ultimoLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuarioId" UUID NOT NULL,
    "fotoPerfil" TEXT,
    "status" "StatusRegistro" NOT NULL DEFAULT 'ATIVO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientePf" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "clienteId" UUID NOT NULL,
    "nomeCompleto" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "dataNascimento" DATE NOT NULL,
    "genero" "Genero" NOT NULL,
    "celular" TEXT NOT NULL,
    "nacionalidade" TEXT NOT NULL DEFAULT 'Brasileira',

    CONSTRAINT "ClientePf_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientePj" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "clienteId" UUID NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "nomeFantasia" TEXT,
    "cnpj" TEXT NOT NULL,
    "nomeResponsavel" TEXT NOT NULL,
    "documentoResponsavel" TEXT NOT NULL,
    "celularComercial" TEXT NOT NULL,

    CONSTRAINT "ClientePj_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Endereco" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "clienteId" UUID NOT NULL,
    "tipo" TEXT,
    "cep" TEXT NOT NULL,
    "logradouro" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "complemento" TEXT,
    "bairro" TEXT NOT NULL,
    "cidade" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "pais" TEXT NOT NULL DEFAULT 'Brasil',

    CONSTRAINT "Endereco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organizador" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "clienteId" UUID NOT NULL,
    "status" "StatusOrganizador" NOT NULL DEFAULT 'PENDENTE',
    "plano" TEXT,
    "comissaoPercentual" DECIMAL(5,2) NOT NULL,
    "chavePix" TEXT,
    "banco" TEXT,
    "agencia" TEXT,
    "conta" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organizador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evento" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizadorId" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "regulamentoUrl" TEXT,
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "dataFim" TIMESTAMP(3) NOT NULL,
    "local" TEXT NOT NULL,
    "cidade" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "capacidade" INTEGER,
    "status" "StatusEvento" NOT NULL DEFAULT 'RASCUNHO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patrocinador" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "eventoId" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "logoUrl" TEXT,
    "site" TEXT,

    CONSTRAINT "Patrocinador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Staff" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "eventoId" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "funcao" TEXT NOT NULL,
    "celular" TEXT,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Modalidade" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "eventoId" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "distanciaKm" DECIMAL(6,2) NOT NULL,
    "descricao" TEXT,
    "idadeMinima" INTEGER,
    "idadeMaxima" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Modalidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Categoria" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "modalidadeId" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "idadeMinima" INTEGER,
    "idadeMaxima" INTEGER,
    "genero" "GeneroCategoria" NOT NULL DEFAULT 'LIVRE',

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lote" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "eventoId" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "quantidade" INTEGER,
    "inicioVenda" TIMESTAMP(3) NOT NULL,
    "fimVenda" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoteModalidadePreco" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "loteId" UUID NOT NULL,
    "modalidadeId" UUID NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "LoteModalidadePreco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inscricao" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "clienteId" UUID NOT NULL,
    "categoriaId" UUID NOT NULL,
    "loteId" UUID NOT NULL,
    "numeroPeito" TEXT,
    "tamanhoCamisa" TEXT,
    "dataInscricao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "StatusInscricao" NOT NULL DEFAULT 'PENDENTE_PAGAMENTO',

    CONSTRAINT "Inscricao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pagamento" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "inscricaoId" UUID NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "metodo" "MetodoPagamento" NOT NULL,
    "status" "StatusPagamento" NOT NULL DEFAULT 'PENDENTE',
    "gateway" TEXT,
    "codigoTransacao" TEXT,
    "dataPagamento" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certificado" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "inscricaoId" UUID NOT NULL,
    "urlPdf" TEXT NOT NULL,
    "dataEmissao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Certificado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resultado" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "inscricaoId" UUID NOT NULL,
    "tempoBrutoSegundos" INTEGER,
    "tempoLiquidoSegundos" INTEGER,
    "colocacaoGeral" INTEGER,
    "colocacaoCategoria" INTEGER,
    "colocacaoGenero" INTEGER,
    "status" "StatusResultado" NOT NULL DEFAULT 'FINALIZADO',

    CONSTRAINT "Resultado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_usuarioId_key" ON "Cliente"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientePf_clienteId_key" ON "ClientePf"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientePf_cpf_key" ON "ClientePf"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "ClientePj_clienteId_key" ON "ClientePj"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientePj_cnpj_key" ON "ClientePj"("cnpj");

-- CreateIndex
CREATE INDEX "Endereco_clienteId_idx" ON "Endereco"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "Organizador_clienteId_key" ON "Organizador"("clienteId");

-- CreateIndex
CREATE INDEX "Evento_status_dataInicio_idx" ON "Evento"("status", "dataInicio");

-- CreateIndex
CREATE UNIQUE INDEX "LoteModalidadePreco_loteId_modalidadeId_key" ON "LoteModalidadePreco"("loteId", "modalidadeId");

-- CreateIndex
CREATE INDEX "Inscricao_status_idx" ON "Inscricao"("status");

-- CreateIndex
CREATE INDEX "Pagamento_inscricaoId_status_idx" ON "Pagamento"("inscricaoId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Certificado_inscricaoId_key" ON "Certificado"("inscricaoId");

-- CreateIndex
CREATE UNIQUE INDEX "Resultado_inscricaoId_key" ON "Resultado"("inscricaoId");

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientePf" ADD CONSTRAINT "ClientePf_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientePj" ADD CONSTRAINT "ClientePj_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Endereco" ADD CONSTRAINT "Endereco_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organizador" ADD CONSTRAINT "Organizador_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evento" ADD CONSTRAINT "Evento_organizadorId_fkey" FOREIGN KEY ("organizadorId") REFERENCES "Organizador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patrocinador" ADD CONSTRAINT "Patrocinador_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "Evento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "Evento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Modalidade" ADD CONSTRAINT "Modalidade_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "Evento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Categoria" ADD CONSTRAINT "Categoria_modalidadeId_fkey" FOREIGN KEY ("modalidadeId") REFERENCES "Modalidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lote" ADD CONSTRAINT "Lote_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "Evento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoteModalidadePreco" ADD CONSTRAINT "LoteModalidadePreco_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "Lote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoteModalidadePreco" ADD CONSTRAINT "LoteModalidadePreco_modalidadeId_fkey" FOREIGN KEY ("modalidadeId") REFERENCES "Modalidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscricao" ADD CONSTRAINT "Inscricao_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscricao" ADD CONSTRAINT "Inscricao_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inscricao" ADD CONSTRAINT "Inscricao_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "Lote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pagamento" ADD CONSTRAINT "Pagamento_inscricaoId_fkey" FOREIGN KEY ("inscricaoId") REFERENCES "Inscricao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificado" ADD CONSTRAINT "Certificado_inscricaoId_fkey" FOREIGN KEY ("inscricaoId") REFERENCES "Inscricao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resultado" ADD CONSTRAINT "Resultado_inscricaoId_fkey" FOREIGN KEY ("inscricaoId") REFERENCES "Inscricao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
