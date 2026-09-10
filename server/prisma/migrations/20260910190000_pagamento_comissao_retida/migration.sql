-- Os dois painels financeiros recalculavam a comissao da plataforma por conta
-- propria, cada um com uma formula, e nenhuma batia com o extrato do gateway:
--   admin      -> valor * percentual                  (R$ 2,31 num caso real)
--   organizador-> (valor - taxaGateway) * percentual  (R$ 2,20 no mesmo caso)
-- enquanto o application_fee realmente retido era R$ 2,00. O valor cobrado do
-- atleta ja embute a comissao e a tarifa, entao aplicar o percentual sobre ele
-- cobra percentual em cima de percentual.
--
-- A coluna passa a guardar o numero que foi de fato enviado ao gateway.
ALTER TABLE "Pagamento" ADD COLUMN IF NOT EXISTS "comissaoPlataforma" DECIMAL(10,2);

-- Backfill do historico. Ate aqui NENHUM evento tinha `comissaoPagaPeloAtleta`
-- ligado (default false no banco e no formulario), entao em toda venda antiga
-- `valor - taxaGateway` E exatamente a base sobre a qual a comissao foi retida,
-- e a conta reproduz o application_fee da epoca.
--
-- So aprovados (os demais nunca reteram nada) e so onde `taxaGateway` existe:
-- sem ela a base nao e recuperavel, e preencher com um palpite seria pior que
-- deixar nulo - o painel cai no calculo antigo, que da o mesmo numero, sem
-- gravar no banco um valor que ninguem apurou.
--
-- Ressalva conhecida: evento organizado pela propria plataforma retem zero
-- (nao ha application_fee), e isto nao tem como saber em SQL. Vale so para o
-- historico; da cobranca nova em diante o valor gravado e o real.
UPDATE "Pagamento" p
SET "comissaoPlataforma" = ROUND(
      (p."valor" - p."taxaGateway") * (o."comissaoPercentual" / 100),
      2
    )
FROM "Inscricao" i
JOIN "Categoria" c    ON c."id" = i."categoriaId"
JOIN "Modalidade" m   ON m."id" = c."modalidadeId"
JOIN "Evento" e       ON e."id" = m."eventoId"
JOIN "Organizador" o  ON o."id" = e."organizadorId"
WHERE p."inscricaoId" = i."id"
  AND p."status" = 'APROVADO'
  AND p."taxaGateway" IS NOT NULL
  AND p."comissaoPlataforma" IS NULL;

-- Pagamentos de pedido (carrinho com varias inscricoes) chegam pelo pedidoId:
-- a comissao e a mesma para o pedido inteiro, entao basta uma inscricao dele
-- para achar o organizador.
UPDATE "Pagamento" p
SET "comissaoPlataforma" = ROUND(
      (p."valor" - p."taxaGateway") * (o."comissaoPercentual" / 100),
      2
    )
FROM "Inscricao" i
JOIN "Categoria" c    ON c."id" = i."categoriaId"
JOIN "Modalidade" m   ON m."id" = c."modalidadeId"
JOIN "Evento" e       ON e."id" = m."eventoId"
JOIN "Organizador" o  ON o."id" = e."organizadorId"
WHERE p."pedidoId" = i."pedidoId"
  AND p."status" = 'APROVADO'
  AND p."taxaGateway" IS NOT NULL
  AND p."comissaoPlataforma" IS NULL;
