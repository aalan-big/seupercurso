import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import {
  StatusEvento,
  StatusInscricao,
  StatusOrganizador,
  StatusPagamento,
} from '../generated/prisma/enums';

import { montarSerieDiaria } from '../common/montar-serie-diaria';

const ORGANIZADOR_INCLUDE = {
  cliente: {
    include: {
      usuario: { select: { email: true } },
      pf: true,
      pj: true,
      enderecos: true,
    },
  },
} as const;

const EVENTO_INCLUDE = {
  organizador: { include: ORGANIZADOR_INCLUDE },
  modalidades: { include: { categorias: true } },
} as const;

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listarOrganizadores(status?: string) {
    const whereClause: Prisma.OrganizadorWhereInput = status
      ? {
          status: status as StatusOrganizador,
          ...(status === StatusOrganizador.PENDENTE
            ? {
                fotoRostoUrl: { not: null },
                documentoIdentidadeUrl: { not: null },
              }
            : {}),
        }
      : {};

    return this.prisma.organizador.findMany({
      where: whereClause,
      orderBy: { createdAt: 'asc' },
      include: ORGANIZADOR_INCLUDE,
    });
  }


  async buscarOrganizador(id: string) {
    const organizador = await this.prisma.organizador.findUnique({
      where: { id },
      include: ORGANIZADOR_INCLUDE,
    });
    if (!organizador) {
      throw new NotFoundException('Organizador não encontrado.');
    }
    return organizador;
  }

  async aprovarOrganizador(id: string) {
    const organizador = await this.getOrganizadorOuFalhar(id);

    return this.prisma.organizador.update({
      where: { id },
      data: { status: StatusOrganizador.APROVADO, motivoRevisao: null },
      include: ORGANIZADOR_INCLUDE,
    });
  }

  async rejeitarOrganizador(id: string, motivo?: string) {
    await this.getOrganizadorOuFalhar(id);

    return this.prisma.organizador.update({
      where: { id },
      data: { status: StatusOrganizador.REJEITADO, motivoRevisao: motivo ?? null },
      include: ORGANIZADOR_INCLUDE,
    });
  }

  async suspenderOrganizador(id: string, motivo?: string) {
    const organizador = await this.getOrganizadorOuFalhar(id);

    if (organizador.status !== StatusOrganizador.APROVADO) {
      throw new BadRequestException(
        'Só é possível suspender um organizador que já está aprovado.',
      );
    }

    return this.prisma.organizador.update({
      where: { id },
      data: { status: StatusOrganizador.SUSPENSO, motivoRevisao: motivo ?? null },
      include: ORGANIZADOR_INCLUDE,
    });
  }

  async listarEventos(status?: string) {
    return this.prisma.evento.findMany({
      where: status ? { status: status as StatusEvento } : undefined,
      orderBy: { createdAt: 'asc' },
      include: EVENTO_INCLUDE,
    });
  }

  async buscarEvento(id: string) {
    const evento = await this.prisma.evento.findUnique({
      where: { id },
      include: EVENTO_INCLUDE,
    });
    if (!evento) {
      throw new NotFoundException('Evento não encontrado.');
    }
    return evento;
  }

  async aprovarEvento(id: string) {
    await this.getEventoOuFalhar(id);

    return this.prisma.evento.update({
      where: { id },
      data: { status: StatusEvento.PUBLICADO, motivoRejeicao: null },
      include: EVENTO_INCLUDE,
    });
  }

  async rejeitarEvento(id: string, motivo?: string) {
    await this.getEventoOuFalhar(id);

    return this.prisma.evento.update({
      where: { id },
      data: { status: StatusEvento.RASCUNHO, motivoRejeicao: motivo ?? null },
      include: EVENTO_INCLUDE,
    });
  }

  async suspenderEvento(id: string, motivo?: string) {
    await this.getEventoOuFalhar(id);

    return this.prisma.evento.update({
      where: { id },
      data: { status: StatusEvento.SUSPENSO, motivoRejeicao: motivo ?? 'Evento suspenso/barrado pela administração master da plataforma.' },
      include: EVENTO_INCLUDE,
    });
  }

  async obterDashboard() {
    const DIAS_SERIE = 14;
    const desde = new Date();
    desde.setUTCHours(0, 0, 0, 0);
    desde.setUTCDate(desde.getUTCDate() - (DIAS_SERIE - 1));

    const [
      organizadoresPendentes,
      eventosAguardandoAprovacao,
      organizadoresAprovados,
      eventosPublicados,
      inscricoesConfirmadas,
      organizadoresRecentes,
      eventosRecentes,
      organizadoresPorStatusRaw,
      eventosPorStatusRaw,
      inscricoesRecentes,
    ] = await Promise.all([
      this.prisma.organizador.count({
        where: {
          status: StatusOrganizador.PENDENTE,
          fotoRostoUrl: { not: null },
          documentoIdentidadeUrl: { not: null },
        },
      }),
      this.prisma.evento.count({
        where: { status: StatusEvento.AGUARDANDO_APROVACAO },
      }),
      this.prisma.organizador.count({
        where: { status: StatusOrganizador.APROVADO },
      }),
      this.prisma.evento.count({ where: { status: StatusEvento.PUBLICADO } }),
      this.prisma.inscricao.count({
        where: { status: StatusInscricao.CONFIRMADA },
      }),
      this.prisma.organizador.findMany({
        where: {
          status: StatusOrganizador.PENDENTE,
          fotoRostoUrl: { not: null },
          documentoIdentidadeUrl: { not: null },
        },
        orderBy: { createdAt: 'asc' },
        take: 5,
        include: ORGANIZADOR_INCLUDE,
      }),

      this.prisma.evento.findMany({
        where: { status: StatusEvento.AGUARDANDO_APROVACAO },
        orderBy: { createdAt: 'asc' },
        take: 5,
        include: EVENTO_INCLUDE,
      }),
      this.prisma.organizador.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.evento.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.inscricao.findMany({
        where: {
          status: StatusInscricao.CONFIRMADA,
          dataInscricao: { gte: desde },
        },
        select: { dataInscricao: true },
      }),
    ]);

    const organizadoresPorStatus = Object.fromEntries(
      organizadoresPorStatusRaw.map((linha) => [linha.status, linha._count._all]),
    );
    const eventosPorStatus = Object.fromEntries(
      eventosPorStatusRaw.map((linha) => [linha.status, linha._count._all]),
    );
    const inscricoesPorDia = montarSerieDiaria(
      inscricoesRecentes.map((i) => i.dataInscricao),
      DIAS_SERIE,
    );

    return {
      contadores: {
        organizadoresPendentes,
        eventosAguardandoAprovacao,
        organizadoresAprovados,
        eventosPublicados,
        inscricoesConfirmadas,
      },
      organizadoresPorStatus,
      eventosPorStatus,
      inscricoesPorDia,
      organizadoresRecentes,
      eventosRecentes,
    };
  }

  async obterFinanceiro() {
    const pagamentos = await this.prisma.pagamento.findMany({
      where: { status: StatusPagamento.APROVADO },
      select: {
        valor: true,
        inscricao: {
          select: {
            categoria: {
              select: {
                modalidade: {
                  select: {
                    evento: {
                      select: {
                        id: true,
                        nome: true,
                        organizador: {
                          select: {
                            id: true,
                            comissaoPercentual: true,
                            cliente: {
                              select: {
                                usuario: { select: { email: true } },
                                pf: { select: { nomeCompleto: true } },
                                pj: { select: { razaoSocial: true } },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    interface ResumoValores {
      quantidadePagamentos: number;
      totalArrecadado: number;
      comissaoPlataforma: number;
    }

    interface ResumoEvento extends ResumoValores {
      eventoId: string;
      nome: string;
    }

    interface ResumoOrganizador extends ResumoValores {
      organizadorId: string;
      nome: string;
      eventos: Map<string, ResumoEvento>;
    }

    const porOrganizador = new Map<string, ResumoOrganizador>();
    let totalArrecadado = 0;
    let comissaoPlataforma = 0;

    for (const pagamento of pagamentos) {
      const valor = Number(pagamento.valor);
      const evento = pagamento.inscricao.categoria.modalidade.evento;
      const organizador = evento.organizador;
      const percentual = Number(organizador.comissaoPercentual);
      const comissao = valor * (percentual / 100);

      totalArrecadado += valor;
      comissaoPlataforma += comissao;

      const nomeOrganizador =
        organizador.cliente.pf?.nomeCompleto ||
        organizador.cliente.pj?.razaoSocial ||
        organizador.cliente.usuario.email;

      const resumoOrganizador = porOrganizador.get(organizador.id) ?? {
        organizadorId: organizador.id,
        nome: nomeOrganizador,
        quantidadePagamentos: 0,
        totalArrecadado: 0,
        comissaoPlataforma: 0,
        eventos: new Map<string, ResumoEvento>(),
      };
      resumoOrganizador.quantidadePagamentos += 1;
      resumoOrganizador.totalArrecadado += valor;
      resumoOrganizador.comissaoPlataforma += comissao;

      const resumoEvento = resumoOrganizador.eventos.get(evento.id) ?? {
        eventoId: evento.id,
        nome: evento.nome,
        quantidadePagamentos: 0,
        totalArrecadado: 0,
        comissaoPlataforma: 0,
      };
      resumoEvento.quantidadePagamentos += 1;
      resumoEvento.totalArrecadado += valor;
      resumoEvento.comissaoPlataforma += comissao;
      resumoOrganizador.eventos.set(evento.id, resumoEvento);

      porOrganizador.set(organizador.id, resumoOrganizador);
    }

    return {
      totalArrecadado,
      comissaoPlataforma,
      totalRepasse: totalArrecadado - comissaoPlataforma,
      porOrganizador: Array.from(porOrganizador.values()).map((o) => ({
        organizadorId: o.organizadorId,
        nome: o.nome,
        quantidadePagamentos: o.quantidadePagamentos,
        totalArrecadado: o.totalArrecadado,
        comissaoPlataforma: o.comissaoPlataforma,
        repasse: o.totalArrecadado - o.comissaoPlataforma,
        eventos: Array.from(o.eventos.values()).map((e) => ({
          ...e,
          repasse: e.totalArrecadado - e.comissaoPlataforma,
        })),
      })),
    };
  }

  private async getOrganizadorOuFalhar(id: string) {
    const organizador = await this.prisma.organizador.findUnique({
      where: { id },
    });
    if (!organizador) {
      throw new NotFoundException('Organizador não encontrado.');
    }
    return organizador;
  }

  private async getEventoOuFalhar(id: string) {
    const evento = await this.prisma.evento.findUnique({ where: { id } });
    if (!evento) {
      throw new NotFoundException('Evento não encontrado.');
    }
    return evento;
  }
}
