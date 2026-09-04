-- Public key da conta Mercado Pago do organizador.
--
-- O token do cartao gerado no navegador fica preso a conta que o emitiu. Como a
-- cobranca roda na conta do organizador (OAuth), tokenizar com a chave da
-- plataforma faz o Mercado Pago recusar o pagamento. A chave vem na mesma
-- resposta do OAuth; para quem ja estava conectado, ela e preenchida na
-- primeira renovacao do token.
ALTER TABLE "Organizador" ADD COLUMN IF NOT EXISTS "mpPublicKey" TEXT;
