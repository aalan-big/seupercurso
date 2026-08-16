-- Garante que uma inscrição nunca tenha mais de um pagamento com status
-- APROVADO, mesmo permitindo múltiplas tentativas (retries) de pagamento.
-- Índice único parcial: não é expressável no schema.prisma.
CREATE UNIQUE INDEX "Pagamento_inscricaoId_aprovado_key"
  ON "Pagamento" ("inscricaoId")
  WHERE "status" = 'APROVADO';
