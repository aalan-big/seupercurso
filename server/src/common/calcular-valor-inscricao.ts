import { PrismaService } from '../prisma/prisma.service';
import { resolverPreco } from './resolver-preco';
import { calcularIdade } from './calcular-idade';

interface ContextoValor {
  loteId: string;
  modalidadeId: string;
  clienteId: string;
  eventoId: string;
  cupomId?: string | null;
}

export async function calcularValorInscricao(
  prisma: PrismaService,
  ctx: ContextoValor,
): Promise<number> {
  const preco = await resolverPreco(prisma, ctx.loteId, ctx.modalidadeId);
  let valor = Number(preco.valor);

  const evento = await prisma.evento.findUnique({
    where: { id: ctx.eventoId },
    select: { aplicaDescontoIdoso: true, percentualDescontoIdoso: true, dataInicio: true },
  });

  if (evento?.aplicaDescontoIdoso && evento.percentualDescontoIdoso) {
    const cliente = await prisma.cliente.findUnique({
      where: { id: ctx.clienteId },
      include: { pf: true },
    });
    if (cliente?.pf) {
      const idade = calcularIdade(cliente.pf.dataNascimento, evento.dataInicio);
      if (idade >= 60) {
        valor -= valor * (Number(evento.percentualDescontoIdoso) / 100);
      }
    }
  }

  if (ctx.cupomId) {
    const cupom = await prisma.cupom.findUnique({ where: { id: ctx.cupomId } });
    if (cupom?.ativo) {
      valor -= valor * (Number(cupom.percentualDesconto) / 100);
    }
  }

  return Math.max(0, Number(valor.toFixed(2)));
}
