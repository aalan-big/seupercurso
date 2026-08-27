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
}

export async function calcularValorInscricao(
  prisma: PrismaService,
  ctx: ContextoValor,
): Promise<number> {
  const preco = await resolverPreco(prisma, ctx.loteId, ctx.modalidadeId);
  const valorBaseCheio = Number(preco.valor);
  let valor = valorBaseCheio;

  const evento = await prisma.evento.findUnique({
    where: { id: ctx.eventoId },
    select: {
      aplicaDescontoIdoso: true,
      percentualDescontoIdoso: true,
      dataInicio: true,
      taxaRepassadaAtleta: true,
      organizador: { select: { comissaoPercentual: true } },
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

  // Taxa fixa da plataforma sobre o valor cheio do evento (ex: 10% de R$ 70,00 = R$ 7,00)
  const percentualComissao = Number(evento?.organizador?.comissaoPercentual ?? 10);
  const taxaPlataformaFixa = valorBaseCheio * (percentualComissao / 100);

  // Se o organizador optou por repassar a taxa ao atleta, soma no total final
  if (evento?.taxaRepassadaAtleta) {
    valor += taxaPlataformaFixa;
  }

  return Math.max(0, Number(valor.toFixed(2)));
}
