-- Havia dois campos respondendo a mesma pergunta ("quem paga a comissao"):
-- `taxaRepassadaAtleta`, somado no preco da inscricao, e `comissaoPagaPeloAtleta`,
-- somado como taxa de servico no pagamento. Ligados juntos, cobravam duas vezes;
-- ligado so o primeiro, a comissao era calculada sobre a base ja inflada e o
-- organizador recebia a menos (R$ 99 em vez de R$ 100, numa inscricao de R$ 100).
--
-- O codigo passou a ler apenas `comissaoPagaPeloAtleta`. Estes UPDATEs preservam
-- a intencao de quem ja tinha o repasse ligado: o atleta continua pagando
-- exatamente o mesmo valor, e o organizador passa a receber o preco cheio.

-- 1) Preserva a intencao: quem repassava continua repassando, agora pelo campo certo.
UPDATE "Evento"
SET "comissaoPagaPeloAtleta" = true
WHERE "taxaRepassadaAtleta" = true
  AND "comissaoPagaPeloAtleta" = false;

-- 2) Zera o campo aposentado. Nao e cosmetico: se o codigo for revertido, ele
-- volta a ser lido, e um `true` aqui somado ao `comissaoPagaPeloAtleta` que
-- acabamos de ligar cobraria a comissao duas vezes. Com false, o revert do
-- codigo devolve exatamente o mesmo preco de hoje.
UPDATE "Evento"
SET "taxaRepassadaAtleta" = false
WHERE "taxaRepassadaAtleta" = true;

-- A coluna permanece na tabela de proposito: parar de ler e reversivel, dropar
-- nao e. Ela sai numa migracao futura, depois que isto estiver assentado.
