import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export async function resolverPreco(
  prisma: PrismaService,
  loteId: string,
  modalidadeId: string,
) {
  const preco = await prisma.loteModalidadePreco.findUnique({
    where: { loteId_modalidadeId: { loteId, modalidadeId } },
  });

  if (!preco) {
    throw new BadRequestException(
      'Não há preço definido para essa modalidade neste lote.',
    );
  }

  return preco;
}
