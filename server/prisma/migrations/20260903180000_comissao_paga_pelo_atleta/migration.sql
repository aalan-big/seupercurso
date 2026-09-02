-- O organizador passa a escolher quem paga a comissao da plataforma: ele
-- (absorvendo no repasse) ou o atleta (como taxa de servico no checkout).
-- Padrao false mantem o comportamento atual dos eventos ja publicados.
ALTER TABLE "Evento" ADD COLUMN IF NOT EXISTS "comissaoPagaPeloAtleta" BOOLEAN NOT NULL DEFAULT false;
