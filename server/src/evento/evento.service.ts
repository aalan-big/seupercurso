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
  taxaRepassadaAtleta: true,
  aceitaPix: true,
  aceitaCartao: true,
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

    const usosEfetivos = await this.prisma.inscricao.count({
      where: {
        cupomId: cupom.id,
        status: {
          notIn: [StatusInscricao.CANCELADA, StatusInscricao.EXPIRADA],
        },
      },
    });

    if (
      cupom.quantidadeMaxima !== null &&
      usosEfetivos >= cupom.quantidadeMaxima
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
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    let targetId = id;
    if (!isUuid) {
      const todosEventos = await this.prisma.evento.findMany({
        where: { status: StatusEvento.PUBLICADO },
        select: { id: true },
      });
      const encontrado = todosEventos.find((e) => e.id.toLowerCase().startsWith(id.toLowerCase()));
      if (encontrado) {
        targetId = encontrado.id;
      }
    }

    const evento = await this.prisma.evento.findFirst({
      where: { id: targetId, status: StatusEvento.PUBLICADO },
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
            capacidade: true,
            mapaPercursoUrl: true,
            mapaEmbedUrl: true,
            gpxUrl: true,
            rotaGeoJson: true,
            categorias: {
              select: {
                id: true,
                nome: true,
                idadeMinima: true,
                idadeMaxima: true,
                genero: true,
                pcd: true,
                capacidade: true,
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

    // Garante que todas as modalidades ativas do evento tenham ao menos 1 categoria (Geral)
    for (const mod of evento.modalidades) {
      if (mod.ativo && mod.categorias.length === 0) {
        const catPadrao = await this.prisma.categoria.create({
          data: {
            modalidadeId: mod.id,
            nome: 'Geral',
            genero: 'LIVRE',
            pcd: false,
          },
          select: {
            id: true,
            nome: true,
            idadeMinima: true,
            idadeMaxima: true,
            genero: true,
            pcd: true,
            capacidade: true,
          },
        });
        mod.categorias.push({ ...catPadrao, _count: { inscricoes: 0 } });
      }
    }

    const totalInscritosEvento = evento.modalidades.reduce(
      (acc, mod) =>
        acc + mod.categorias.reduce((acc2, cat) => acc2 + cat._count.inscricoes, 0),
      0,
    );

    return {
      ...evento,
      vagasRestantes:
        evento.capacidade === null
          ? null
          : evento.capacidade - totalInscritosEvento,
      modalidades: evento.modalidades.map((mod) => {
        const inscritosModalidade = mod.categorias.reduce(
          (acc, cat) => acc + cat._count.inscricoes,
          0,
        );
        return {
          ...mod,
          vagasRestantes:
            mod.capacidade === null
              ? null
              : mod.capacidade - inscritosModalidade,
          categorias: mod.categorias.map(({ _count, ...categoria }) => ({
            ...categoria,
            vagasRestantes:
              categoria.capacidade === null
                ? null
                : categoria.capacidade - _count.inscricoes,
          })),
        };
      }),
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
