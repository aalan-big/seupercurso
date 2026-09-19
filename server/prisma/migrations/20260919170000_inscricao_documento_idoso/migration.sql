-- O desconto do idoso era aplicado so pela data de nascimento que a propria
-- pessoa digitava (cadastro, perfil, dependente ou convidado no carrinho), sem
-- nenhuma comprovacao. Passa a exigir documento com foto na inscricao, guardado
-- aqui para o organizador conferir na entrega do kit.
ALTER TABLE "Inscricao" ADD COLUMN IF NOT EXISTS "documentoIdosoUrl" TEXT;
