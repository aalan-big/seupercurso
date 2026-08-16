import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StatusEvento, StatusInscricao } from '../generated/prisma/enums';

const RESUMO_SELECT = {
  id: true,
  nome: true,
  descricao: true,
  dataInicio: true,
  dataFim: true,
  local: true,
  cidade: true,
  estado: true,
  capacidade: true,
  status: true,
  regulamentoUrl: true,
} as const;

@Injectable()
export class EventoService {
  constructor(private readonly prisma: PrismaService) {}

  async findPublicados() {
    const agora = new Date();

    const eventos = await this.prisma.evento.findMany({
      where: { status: StatusEvento.PUBLICADO },
      select: {
        ...RESUMO_SELECT,
        lotes: {
          where: { inicioVenda: { lte: agora }, fimVenda: { gte: agora } },
          select: { precos: { select: { valor: true } } },
        },
      },
      orderBy: { dataInicio: 'asc' },
    });

    return eventos.map(({ lotes, ...evento }) => {
      const valores = lotes.flatMap((lote) =>
        lote.precos.map((preco) => Number(preco.valor)),
      );
      return {
        ...evento,
        valorApartirDe: valores.length > 0 ? Math.min(...valores) : null,
      };
    });
  }

  async findOneDetalhado(id: string) {
    const evento = await this.prisma.evento.findFirst({
      where: { id, status: StatusEvento.PUBLICADO },
      select: {
        ...RESUMO_SELECT,
        modalidades: {
          select: {
            id: true,
            nome: true,
            distanciaKm: true,
            descricao: true,
            idadeMinima: true,
            idadeMaxima: true,
            ativo: true,
            categorias: {
              select: {
                id: true,
                nome: true,
                idadeMinima: true,
                idadeMaxima: true,
                genero: true,
                pcd: true,
              },
            },
          },
        },
        lotes: {
          select: {
            id: true,
            nome: true,
            quantidade: true,
            inicioVenda: true,
            fimVenda: true,
            precos: {
              select: { id: true, modalidadeId: true, valor: true },
            },
            _count: {
              select: {
                inscricoes: {
                  where: {
                    status: {
                      notIn: [
                        StatusInscricao.CANCELADA,
                        StatusInscricao.EXPIRADA,
                      ],
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!evento) {
      throw new NotFoundException('Evento não encontrado.');
    }

    return {
      ...evento,
      lotes: evento.lotes.map(({ _count, ...lote }) => ({
        ...lote,
        vagasRestantes:
          lote.quantidade === null
            ? null
            : lote.quantidade - _count.inscricoes,
      })),
    };
  }
}
