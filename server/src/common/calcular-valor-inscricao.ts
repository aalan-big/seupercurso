import { PrismaService } from '../prisma/prisma.service';
import { resolverPreco } from './resolver-preco';
import { calcularIdade } from './calcular-idade';

interface ContextoValor {
  loteId: string;
  modalidadeId: string;
  clienteId: string;
  eventoId: string;
  cupomId?: string | null;
  dataNascimentoAtleta?: Date | null;
  incluiCamisa?: boolean;
}

export async function calcularValorInscricao(
  prisma: PrismaService,
  ctx: ContextoValor,
): Promise<number> {
  const preco = await resolverPreco(prisma, ctx.loteId, ctx.modalidadeId);
  let valor = Number(preco.valor);

  const evento = await prisma.evento.findUnique({
    where: { id: ctx.eventoId },
    select: {
      aplicaDescontoIdoso: true,
      percentualDescontoIdoso: true,
      dataInicio: true,
      camisaOpcional: true,
      valorCamisaOpcional: true,
    },
  });

  if (evento?.aplicaDescontoIdoso && evento.percentualDescontoIdoso) {
    let dataNasc: Date | null = ctx.dataNascimentoAtleta || null;
    if (!dataNasc) {
      const cliente = await prisma.cliente.findUnique({
        where: { id: ctx.clienteId },
        include: { pf: true },
      });
      dataNasc = cliente?.pf?.dataNascimento || null;
    }

    if (dataNasc) {
      const idade = calcularIdade(dataNasc, evento.dataInicio);
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

  // Se o evento oferece camisa opcional e o participante optou por incluí-la:
  if (evento?.camisaOpcional && ctx.incluiCamisa && evento.valorCamisaOpcional) {
    valor += Number(evento.valorCamisaOpcional);
  }

  // A comissao da plataforma NAO entra aqui. Esta funcao devolve so o preco da
  // inscricao; quem paga a comissao e decidido no pagamento, por
  // `Evento.comissaoPagaPeloAtleta`, e somada la como taxa de servico. Somar
  // aqui inflava a base sobre a qual a propria comissao era calculada.
  return Math.max(0, Number(valor.toFixed(2)));
}
