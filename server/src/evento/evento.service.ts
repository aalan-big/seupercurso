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
  bannerUrl: true,
  mapaPercursoUrl: true,
  mapaEmbedUrl: true,
  gpxUrl: true,
  rotaGeoJson: true,
  taxaRepassadaAtleta: true,
} as const;

@Injectable()
export class EventoService {
  constructor(private readonly prisma: PrismaService) {}

  async validarCupom(eventoId: string, codigo: string) {
    const codigoLimpo = (codigo || '').trim();
    if (!codigoLimpo) {
      throw new NotFoundException('Informe o código do cupom.');
    }

    const cupom = await this.prisma.cupom.findFirst({
      where: {
        eventoId,
        codigo: { equals: codigoLimpo, mode: 'insensitive' },
      },
    });

    if (!cupom) {
      throw new NotFoundException(`Cupom "${codigoLimpo}" não encontrado para este evento.`);
    }

    if (!cupom.ativo) {
      throw new NotFoundException('Este cupom está inativo no momento.');
    }

    if (cupom.validoAte && cupom.validoAte < new Date()) {
      throw new NotFoundException('Este cupom expirou.');
    }

    if (
      cupom.quantidadeMaxima !== null &&
      cupom.usosAtuais >= cupom.quantidadeMaxima
    ) {
      throw new NotFoundException('Este cupom já atingiu o limite de usos.');
    }

    return {
      valido: true,
      codigo: cupom.codigo,
      percentualDesconto: Number(cupom.percentualDesconto),
    };
  }

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
