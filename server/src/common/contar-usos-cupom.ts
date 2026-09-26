import { StatusInscricao } from '../generated/prisma/enums';

// Mesmo prazo do PIX (HORAS_VALIDADE_PIX no pagamento). Antes toda inscricao
// pendente contava para sempre: quem gerava o PIX e desistia gastava um uso do
// cupom, e um cupom de 1 uso travava o proprio comprador na segunda tentativa.
export const HORAS_RESERVA_CUPOM = 24;

interface PrismaComInscricao {
  inscricao: { count(args: any): Promise<number> };
}

/**
 * Usos que ocupam o limite do cupom: inscricoes pagas e pendentes recentes de
 * outros compradores. As pendentes do proprio comprador nao contam, porque ele
 * esta refazendo a mesma compra.
 */
export function contarUsosCupom(
  prisma: PrismaComInscricao,
  cupomId: string,
  clienteIdComprador?: string | null,
): Promise<number> {
  const limiteReserva = new Date(Date.now() - HORAS_RESERVA_CUPOM * 60 * 60 * 1000);

  return prisma.inscricao.count({
    where: {
      cupomId,
      OR: [
        { status: StatusInscricao.CONFIRMADA },
        {
          status: StatusInscricao.PENDENTE_PAGAMENTO,
          dataInscricao: { gte: limiteReserva },
          ...(clienteIdComprador ? { clienteId: { not: clienteIdComprador } } : {}),
        },
      ],
    },
  });
}
