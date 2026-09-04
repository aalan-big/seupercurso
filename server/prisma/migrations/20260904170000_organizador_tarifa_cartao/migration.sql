-- Tarifa de cartao por organizador.
--
-- Cada um recebe na propria conta do Mercado Pago, e a tarifa depende do prazo
-- de liberacao que ele escolheu la (na hora ~4,98%, 30 dias ~3,98%). Com uma
-- unica tarifa global, o gross-up erra para todo organizador cujo prazo seja
-- diferente do nosso, e a diferenca sai do repasse dele.
--
-- Nula ate a primeira venda a vista: e do proprio pagamento que aprendemos a
-- tarifa real, porque o Mercado Pago nao expoe isso por API antes disso.
ALTER TABLE "Organizador" ADD COLUMN IF NOT EXISTS "tarifaCartaoPercentual" DECIMAL(6,4);
