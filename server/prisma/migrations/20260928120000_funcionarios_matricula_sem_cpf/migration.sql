-- Desconto para funcionarios: a chave passa a ser a matricula (ou contrato/
-- cracha) e o CPF fica opcional, porque o RH das empresas costuma mandar so
-- matricula e nome. So afeta a tabela FuncionarioEmpresa.
--
-- ANTES de aplicar em producao, confira que nao ha matricula repetida no mesmo
-- evento (senao o indice unico falha e nada e alterado):
--   SELECT "eventoId", "matricula", COUNT(*) FROM "FuncionarioEmpresa"
--   GROUP BY 1, 2 HAVING COUNT(*) > 1;

-- DropIndex
DROP INDEX "FuncionarioEmpresa_eventoId_matricula_idx";

-- AlterTable
ALTER TABLE "FuncionarioEmpresa" ALTER COLUMN "cpf" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "FuncionarioEmpresa_eventoId_matricula_key" ON "FuncionarioEmpresa"("eventoId", "matricula");
