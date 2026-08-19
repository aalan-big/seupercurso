import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { unlink } from 'fs/promises';
import { join } from 'path';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import {
  StatusEvento,
  StatusInscricao,
  StatusOrganizador,
  StatusPagamento,
  StatusResultado,
} from '../generated/prisma/enums';
import { montarSerieDiaria } from '../common/montar-serie-diaria';
import { CreateEventoDto } from './dto/create-evento.dto';
import { UpdateEventoDto } from './dto/update-evento.dto';
import { CreateModalidadeDto } from './dto/create-modalidade.dto';
import { UpdateModalidadeDto } from './dto/update-modalidade.dto';
import { CreateCategoriaDto } from './dto/create-categoria.dto';
import { UpdateCategoriaDto } from './dto/update-categoria.dto';
import { CreateLoteDto } from './dto/create-lote.dto';
import { UpdateLoteDto } from './dto/update-lote.dto';
import { DefinirPrecoDto } from './dto/definir-preco.dto';
import { CreateCupomDto } from './dto/create-cupom.dto';
import { UpdateDadosBancariosDto } from './dto/update-dados-bancarios.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';

const COMISSAO_PADRAO = 10;
const STAFF_SALT_ROUNDS = 12;

interface FiltrosInscritos {
  eventoId?: string;
  status?: string;
  busca?: string;
}

function paraSegundos(tempo?: string): number | undefined {
  if (!tempo) return undefined;
  const partes = tempo.split(':').map(Number);
  if (partes.some((parte) => Number.isNaN(parte))) return undefined;
  if (partes.length === 3) return partes[0] * 3600 + partes[1] * 60 + partes[2];
  if (partes.length === 2) return partes[0] * 60 + partes[1];
  return undefined;
}

import { AsaasService } from '../pagamento/asaas.service';

@Injectable()
export class OrganizadorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly asaasService: AsaasService,
  ) {}

  async solicitarCadastro(usuarioId: string) {
    let cliente = await this.prisma.cliente.findUnique({
      where: { usuarioId },
      include: { organizador: true },
    });

    if (cliente?.organizador) {
      throw new ConflictException(
        'Você já solicitou cadastro como organizador.',
      );
    }

    if (!cliente) {
      cliente = await this.prisma.cliente.create({
        data: { usuarioId },
        include: { organizador: true },
      });
    }

    return this.prisma.organizador.create({
      data: {
        clienteId: cliente.id,
        status: StatusOrganizador.PENDENTE,
        comissaoPercentual: COMISSAO_PADRAO,
      },
    });
  }

  async getMe(usuarioId: string) {
    return this.getOrganizadorOuFalhar(usuarioId);
  }

  async listarMeusEventos(usuarioId: string) {
    const organizador = await this.getOrganizadorOuFalhar(usuarioId);

    return this.prisma.evento.findMany({
      where: { organizadorId: organizador.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async obterDashboard(usuarioId: string) {
    const organizador = await this.getOrganizadorOuFalhar(usuarioId);

    const DIAS_SERIE = 14;
    const desde = new Date();
    desde.setUTCHours(0, 0, 0, 0);
    desde.setUTCDate(desde.getUTCDate() - (DIAS_SERIE - 1));

    const [
      totalEventos,
      eventosPublicados,
      eventosAguardandoAprovacao,
      inscricoesConfirmadas,
      kitsPendentes,
      proximosEventos,
      eventosPorStatusRaw,
      inscricoesRecentes,
    ] = await Promise.all([
      this.prisma.evento.count({ where: { organizadorId: organizador.id } }),
      this.prisma.evento.count({
        where: { organizadorId: organizador.id, status: StatusEvento.PUBLICADO },
      }),
      this.prisma.evento.count({
        where: {
          organizadorId: organizador.id,
          status: StatusEvento.AGUARDANDO_APROVACAO,
        },
      }),
      this.prisma.inscricao.count({
        where: {
          status: StatusInscricao.CONFIRMADA,
          categoria: { modalidade: { evento: { organizadorId: organizador.id } } },
        },
      }),
      this.prisma.inscricao.count({
        where: {
          status: StatusInscricao.CONFIRMADA,
          kitEntregueEm: null,
          categoria: { modalidade: { evento: { organizadorId: organizador.id } } },
        },
      }),
      this.prisma.evento.findMany({
        where: {
          organizadorId: organizador.id,
          status: StatusEvento.PUBLICADO,
          dataInicio: { gte: new Date() },
        },
        orderBy: { dataInicio: 'asc' },
        take: 5,
        select: { id: true, nome: true, dataInicio: true, cidade: true, estado: true },
      }),
      this.prisma.evento.groupBy({
        by: ['status'],
        where: { organizadorId: organizador.id },
        _count: { _all: true },
      }),
      this.prisma.inscricao.findMany({
        where: {
          status: StatusInscricao.CONFIRMADA,
          dataInscricao: { gte: desde },
          categoria: { modalidade: { evento: { organizadorId: organizador.id } } },
        },
        select: { dataInscricao: true },
      }),
    ]);

    const eventosPorStatus = Object.fromEntries(
      eventosPorStatusRaw.map((linha) => [linha.status, linha._count._all]),
    );

    const inscricoesPorDia = montarSerieDiaria(
      inscricoesRecentes.map((i) => i.dataInscricao),
      DIAS_SERIE,
    );

    return {
      contadores: {
        totalEventos,
        eventosPublicados,
        eventosAguardandoAprovacao,
        inscricoesConfirmadas,
        kitsPendentes,
      },
      eventosPorStatus,
      inscricoesPorDia,
      proximosEventos,
    };
  }

  async obterFinanceiro(usuarioId: string) {
    const organizador = await this.getOrganizadorOuFalhar(usuarioId);

    const pagamentos = await this.prisma.pagamento.findMany({
      where: {
        status: StatusPagamento.APROVADO,
        inscricao: {
          categoria: { modalidade: { evento: { organizadorId: organizador.id } } },
        },
      },
      select: {
        valor: true,
        inscricao: {
          select: {
            categoria: {
              select: {
                modalidade: {
                  select: { evento: { select: { id: true, nome: true } } },
                },
              },
            },
          },
        },
      },
    });

    const percentual = Number(organizador.comissaoPercentual);

    interface ResumoEvento {
      eventoId: string;
      nome: string;
      quantidadePagamentos: number;
      totalArrecadado: number;
      comissaoPlataforma: number;
    }

    const porEvento = new Map<string, ResumoEvento>();
    let totalArrecadado = 0;
    let comissaoPlataforma = 0;

    for (const pagamento of pagamentos) {
      const valor = Number(pagamento.valor);
      const comissao = valor * (percentual / 100);
      totalArrecadado += valor;
      comissaoPlataforma += comissao;

      const evento = pagamento.inscricao.categoria.modalidade.evento;
      const atual = porEvento.get(evento.id) ?? {
        eventoId: evento.id,
        nome: evento.nome,
        quantidadePagamentos: 0,
        totalArrecadado: 0,
        comissaoPlataforma: 0,
      };
      atual.quantidadePagamentos += 1;
      atual.totalArrecadado += valor;
      atual.comissaoPlataforma += comissao;
      porEvento.set(evento.id, atual);
    }

    return {
      comissaoPercentual: percentual,
      totalArrecadado,
      comissaoPlataforma,
      totalRepasse: totalArrecadado - comissaoPlataforma,
      porEvento: Array.from(porEvento.values()).map((e) => ({
        ...e,
        repasse: e.totalArrecadado - e.comissaoPlataforma,
      })),
    };
  }

  async criarEvento(usuarioId: string, dto: CreateEventoDto) {
    const organizador = await this.getOrganizadorAprovadoOuFalhar(usuarioId);
    this.validarPeriodo(dto.dataInicio, dto.dataFim);

    return this.prisma.evento.create({
      data: {
        ...dto,
        organizadorId: organizador.id,
        dataInicio: new Date(dto.dataInicio),
        dataFim: new Date(dto.dataFim),
        ...(dto.retiradaKitInicio
          ? { retiradaKitInicio: new Date(dto.retiradaKitInicio) }
          : {}),
        ...(dto.retiradaKitFim
          ? { retiradaKitFim: new Date(dto.retiradaKitFim) }
          : {}),
      },
    });
  }

  async buscarMeuEvento(usuarioId: string, eventoId: string) {
    const organizador = await this.getOrganizadorOuFalhar(usuarioId);
    await this.getEventoDoOrganizadorOuFalhar(organizador.id, eventoId);

    return this.prisma.evento.findUniqueOrThrow({
      where: { id: eventoId },
      include: {
        modalidades: { include: { categorias: true }, orderBy: { createdAt: 'asc' } },
        lotes: { include: { precos: true }, orderBy: { createdAt: 'asc' } },
      },
    });
  }

  async obterKits(usuarioId: string, eventoId: string) {
    const organizador = await this.getOrganizadorOuFalhar(usuarioId);
    await this.getEventoDoOrganizadorOuFalhar(organizador.id, eventoId);

    const inscricoes = await this.prisma.inscricao.findMany({
      where: {
        status: {
          notIn: [StatusInscricao.CANCELADA, StatusInscricao.EXPIRADA],
        },
        categoria: { modalidade: { eventoId } },
      },
      select: {
        tamanhoCamisa: true,
        categoria: {
          select: { modalidade: { select: { id: true, nome: true } } },
        },
      },
    });

    const totalPorTamanho: Record<string, number> = {};
    const porModalidade = new Map<
      string,
      { modalidadeId: string; modalidade: string; tamanhos: Record<string, number> }
    >();

    for (const inscricao of inscricoes) {
      const tamanho = inscricao.tamanhoCamisa || 'Não informado';
      const modalidade = inscricao.categoria.modalidade;

      totalPorTamanho[tamanho] = (totalPorTamanho[tamanho] || 0) + 1;

      if (!porModalidade.has(modalidade.id)) {
        porModalidade.set(modalidade.id, {
          modalidadeId: modalidade.id,
          modalidade: modalidade.nome,
          tamanhos: {},
        });
      }
      const entrada = porModalidade.get(modalidade.id)!;
      entrada.tamanhos[tamanho] = (entrada.tamanhos[tamanho] || 0) + 1;
    }

    return {
      total: inscricoes.length,
      totalPorTamanho,
      porModalidade: Array.from(porModalidade.values()),
    };
  }

  async atualizarEvento(
    usuarioId: string,
    eventoId: string,
    dto: UpdateEventoDto,
  ) {
    const organizador = await this.getOrganizadorAprovadoOuFalhar(usuarioId);
    const evento = await this.getEventoDoOrganizadorOuFalhar(
      organizador.id,
      eventoId,
    );

    if (
      dto.status &&
      dto.status !== evento.status &&
      (dto.status === StatusEvento.PUBLICADO ||
        dto.status === StatusEvento.FINALIZADO)
    ) {
      throw new ForbiddenException(
        'Só a equipe da plataforma pode publicar ou finalizar um evento. Envie pra revisão (status "Aguardando aprovação") e aguarde.',
      );
    }

    this.validarPeriodo(
      dto.dataInicio ?? evento.dataInicio.toISOString(),
      dto.dataFim ?? evento.dataFim.toISOString(),
    );

    return this.prisma.evento.update({
      where: { id: eventoId },
      data: {
        ...dto,
        ...(dto.status === StatusEvento.AGUARDANDO_APROVACAO
          ? { motivoRejeicao: null }
          : {}),
        ...(dto.dataInicio ? { dataInicio: new Date(dto.dataInicio) } : {}),
        ...(dto.dataFim ? { dataFim: new Date(dto.dataFim) } : {}),
        ...(dto.retiradaKitInicio
          ? { retiradaKitInicio: new Date(dto.retiradaKitInicio) }
          : {}),
        ...(dto.retiradaKitFim
          ? { retiradaKitFim: new Date(dto.retiradaKitFim) }
          : {}),
      },
    });
  }

  async atualizarMidiaEvento(
    usuarioId: string,
    eventoId: string,
    campo: 'bannerUrl' | 'mapaPercursoUrl' | 'regulamentoUrl',
    caminhoRelativo: string,
  ) {
    const organizador = await this.getOrganizadorAprovadoOuFalhar(usuarioId);
    const evento = await this.getEventoDoOrganizadorOuFalhar(
      organizador.id,
      eventoId,
    );

    const antigo = evento[campo];
    if (antigo?.startsWith('/uploads/')) {
      unlink(join(process.cwd(), antigo)).catch(() => undefined);
    }

    return this.prisma.evento.update({
      where: { id: eventoId },
      data: { [campo]: caminhoRelativo },
    });
  }

  async listarResultados(usuarioId: string, eventoId: string) {
    const organizador = await this.getOrganizadorOuFalhar(usuarioId);
    await this.getEventoDoOrganizadorOuFalhar(organizador.id, eventoId);

    return this.prisma.resultado.findMany({
      where: { inscricao: { categoria: { modalidade: { eventoId } } } },
      include: {
        inscricao: {
          select: {
            numeroPeito: true,
            cliente: { select: { pf: { select: { nomeCompleto: true } } } },
            categoria: { select: { nome: true } },
            certificado: { select: { id: true } },
          },
        },
      },
      orderBy: [{ colocacaoGeral: 'asc' }],
    });
  }

  async importarResultados(
    usuarioId: string,
    eventoId: string,
    conteudoCsv: string,
  ) {
    const organizador = await this.getOrganizadorAprovadoOuFalhar(usuarioId);
    await this.getEventoDoOrganizadorOuFalhar(organizador.id, eventoId);

    const linhas = conteudoCsv
      .split(/\r?\n/)
      .filter((linha) => linha.trim().length > 0);
    const dados = linhas.slice(1); // primeira linha é o cabeçalho

    let processados = 0;
    const erros: { linha: number; motivo: string }[] = [];

    for (let i = 0; i < dados.length; i++) {
      const colunas = dados[i].split(';').map((c) => c.trim().replace(/^"|"$/g, ''));
      const [
        numeroPeito,
        cpf,
        tempoBruto,
        tempoLiquido,
        colocacaoGeral,
        colocacaoCategoria,
        colocacaoGenero,
        statusTexto,
      ] = colunas;

      if (!numeroPeito && !cpf) {
        erros.push({
          linha: i + 2,
          motivo: 'Informe o número do peito ou o CPF pra identificar o atleta.',
        });
        continue;
      }

      const inscricao = await this.prisma.inscricao.findFirst({
        where: {
          categoria: { modalidade: { eventoId } },
          OR: [
            ...(numeroPeito ? [{ numeroPeito }] : []),
            ...(cpf ? [{ cliente: { pf: { cpf } } }] : []),
          ],
        },
      });

      if (!inscricao) {
        erros.push({
          linha: i + 2,
          motivo: 'Inscrição não encontrada (peito ou CPF não confere com nenhum inscrito).',
        });
        continue;
      }

      const status = Object.values(StatusResultado).includes(
        statusTexto as StatusResultado,
      )
        ? (statusTexto as StatusResultado)
        : StatusResultado.FINALIZADO;

      const dadosResultado = {
        tempoBrutoSegundos: paraSegundos(tempoBruto),
        tempoLiquidoSegundos: paraSegundos(tempoLiquido),
        colocacaoGeral: colocacaoGeral ? Number(colocacaoGeral) : null,
        colocacaoCategoria: colocacaoCategoria ? Number(colocacaoCategoria) : null,
        colocacaoGenero: colocacaoGenero ? Number(colocacaoGenero) : null,
        status,
      };

      await this.prisma.resultado.upsert({
        where: { inscricaoId: inscricao.id },
        update: dadosResultado,
        create: { inscricaoId: inscricao.id, ...dadosResultado },
      });
      processados++;
    }

    return { totalLinhas: dados.length, processados, erros };
  }

  async gerarCertificados(usuarioId: string, eventoId: string) {
    const organizador = await this.getOrganizadorAprovadoOuFalhar(usuarioId);
    await this.getEventoDoOrganizadorOuFalhar(organizador.id, eventoId);

    const pendentes = await this.prisma.inscricao.findMany({
      where: {
        status: StatusInscricao.CONFIRMADA,
        categoria: { modalidade: { eventoId } },
        resultado: { isNot: null },
        certificado: null,
      },
      select: { id: true },
    });

    if (pendentes.length === 0) {
      return { gerados: 0 };
    }

    await this.prisma.certificado.createMany({
      data: pendentes.map((inscricao) => ({
        inscricaoId: inscricao.id,
        urlPdf: `/uploads/certificados/pendente-${inscricao.id}.pdf`,
      })),
    });

    return { gerados: pendentes.length };
  }

  async buscarParaCheckin(usuarioId: string, eventoId: string, busca?: string) {
    const organizador = await this.getOrganizadorOuFalhar(usuarioId);
    return this.buscarParaCheckinCore(organizador.id, eventoId, busca);
  }

  async buscarParaCheckinComoStaff(
    organizadorId: string,
    eventoId: string,
    busca?: string,
  ) {
    return this.buscarParaCheckinCore(organizadorId, eventoId, busca);
  }

  async listarEventosComoStaff(organizadorId: string) {
    return this.prisma.evento.findMany({
      where: { organizadorId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, nome: true },
    });
  }

  private async buscarParaCheckinCore(
    organizadorId: string,
    eventoId: string,
    busca?: string,
  ) {
    await this.getEventoDoOrganizadorOuFalhar(organizadorId, eventoId);

    if (!busca || busca.trim().length < 2) {
      return [];
    }

    return this.prisma.inscricao.findMany({
      where: {
        categoria: { modalidade: { eventoId } },
        OR: [
          { numeroPeito: { contains: busca, mode: 'insensitive' as const } },
          {
            cliente: {
              pf: {
                OR: [
                  { nomeCompleto: { contains: busca, mode: 'insensitive' as const } },
                  { cpf: { contains: busca } },
                ],
              },
            },
          },
        ],
      },
      select: {
        id: true,
        numeroPeito: true,
        tamanhoCamisa: true,
        status: true,
        kitEntregueEm: true,
        cliente: { select: { pf: { select: { nomeCompleto: true, cpf: true } } } },
        categoria: { select: { nome: true, modalidade: { select: { nome: true } } } },
      },
      orderBy: { dataInscricao: 'asc' },
      take: 20,
    });
  }

  async confirmarEntregaKit(usuarioId: string, eventoId: string, inscricaoId: string) {
    const organizador = await this.getOrganizadorAprovadoOuFalhar(usuarioId);
    return this.confirmarEntregaKitCore(organizador.id, eventoId, inscricaoId);
  }

  async confirmarEntregaKitComoStaff(
    organizadorId: string,
    eventoId: string,
    inscricaoId: string,
  ) {
    await this.getOrganizadorPorIdAprovadoOuFalhar(organizadorId);
    return this.confirmarEntregaKitCore(organizadorId, eventoId, inscricaoId);
  }

  async desfazerEntregaKit(usuarioId: string, eventoId: string, inscricaoId: string) {
    const organizador = await this.getOrganizadorAprovadoOuFalhar(usuarioId);
    return this.desfazerEntregaKitCore(organizador.id, eventoId, inscricaoId);
  }

  async desfazerEntregaKitComoStaff(
    organizadorId: string,
    eventoId: string,
    inscricaoId: string,
  ) {
    await this.getOrganizadorPorIdAprovadoOuFalhar(organizadorId);
    return this.desfazerEntregaKitCore(organizadorId, eventoId, inscricaoId);
  }

  private async confirmarEntregaKitCore(
    organizadorId: string,
    eventoId: string,
    inscricaoId: string,
  ) {
    await this.getEventoDoOrganizadorOuFalhar(organizadorId, eventoId);
    const inscricao = await this.getInscricaoDoEventoOuFalhar(eventoId, inscricaoId);

    if (inscricao.status !== StatusInscricao.CONFIRMADA) {
      throw new BadRequestException(
        'Pagamento pendente — não é possível liberar o kit pra essa inscrição.',
      );
    }

    return this.prisma.inscricao.update({
      where: { id: inscricaoId },
      data: { kitEntregueEm: new Date() },
    });
  }

  private async desfazerEntregaKitCore(
    organizadorId: string,
    eventoId: string,
    inscricaoId: string,
  ) {
    await this.getEventoDoOrganizadorOuFalhar(organizadorId, eventoId);
    await this.getInscricaoDoEventoOuFalhar(eventoId, inscricaoId);

    return this.prisma.inscricao.update({
      where: { id: inscricaoId },
      data: { kitEntregueEm: null },
    });
  }

  private async getInscricaoDoEventoOuFalhar(eventoId: string, inscricaoId: string) {
    const inscricao = await this.prisma.inscricao.findUnique({
      where: { id: inscricaoId },
      include: { categoria: { include: { modalidade: true } } },
    });

    if (!inscricao || inscricao.categoria.modalidade.eventoId !== eventoId) {
      throw new NotFoundException('Inscrição não encontrada.');
    }

    return inscricao;
  }

  async listarInscritos(usuarioId: string, filtros: FiltrosInscritos) {
    const organizador = await this.getOrganizadorOuFalhar(usuarioId);

    return this.prisma.inscricao.findMany({
      where: this.whereInscritos(organizador.id, filtros),
      include: {
        cliente: {
          include: {
            pf: true,
            pj: true,
            usuario: { select: { email: true } },
          },
        },
        categoria: { include: { modalidade: { include: { evento: true } } } },
        lote: true,
        pagamentos: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { dataInscricao: 'desc' },
    });
  }

  async atualizarInscricao(
    usuarioId: string,
    inscricaoId: string,
    dto: {
      numeroPeito?: string;
      tamanhoCamisa?: string;
      categoriaId?: string;
      status?: StatusInscricao;
    },
  ) {
    const organizador = await this.getOrganizadorAprovadoOuFalhar(usuarioId);

    const inscricao = await this.prisma.inscricao.findUnique({
      where: { id: inscricaoId },
      include: {
        categoria: {
          include: { modalidade: { include: { evento: true } } },
        },
      },
    });

    if (
      !inscricao ||
      inscricao.categoria.modalidade.evento.organizadorId !== organizador.id
    ) {
      throw new NotFoundException(
        'Inscrição não encontrada ou sem permissão.',
      );
    }

    return this.prisma.inscricao.update({
      where: { id: inscricaoId },
      data: {
        ...(dto.numeroPeito !== undefined ? { numeroPeito: dto.numeroPeito } : {}),
        ...(dto.tamanhoCamisa !== undefined ? { tamanhoCamisa: dto.tamanhoCamisa } : {}),
        ...(dto.categoriaId !== undefined ? { categoriaId: dto.categoriaId } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      include: {
        cliente: {
          include: {
            pf: true,
            pj: true,
            usuario: { select: { email: true } },
          },
        },
        categoria: { include: { modalidade: { include: { evento: true } } } },
        lote: true,
      },
    });
  }

  async exportarInscritosCsv(
    usuarioId: string,
    filtros: FiltrosInscritos,
  ): Promise<string> {
    const inscritos = await this.listarInscritos(usuarioId, filtros);

    const linhas = [
      [
        'Nome',
        'CPF',
        'E-mail',
        'Celular',
        'Evento',
        'Modalidade',
        'Categoria',
        'Numero do peito',
        'Tamanho da camisa',
        'Status',
        'Data da inscricao',
      ].join(';'),
      ...inscritos.map((inscricao) =>
        [
          inscricao.cliente.pf?.nomeCompleto ?? '',
          inscricao.cliente.pf?.cpf ?? '',
          inscricao.cliente.usuario.email,
          inscricao.cliente.pf?.celular ?? '',
          inscricao.categoria.modalidade.evento.nome,
          inscricao.categoria.modalidade.nome,
          inscricao.categoria.nome,
          inscricao.numeroPeito ?? '',
          inscricao.tamanhoCamisa ?? '',
          inscricao.status,
          inscricao.dataInscricao.toISOString(),
        ]
          .map((valor) => `"${String(valor).replace(/"/g, '""')}"`)
          .join(';'),
      ),
    ];

    return linhas.join('\n');
  }

  private whereInscritos(organizadorId: string, filtros: FiltrosInscritos) {
    const statusValido =
      filtros.status &&
      Object.values(StatusInscricao).includes(
        filtros.status as StatusInscricao,
      )
        ? (filtros.status as StatusInscricao)
        : undefined;

    return {
      categoria: {
        modalidade: {
          evento: {
            organizadorId,
            ...(filtros.eventoId ? { id: filtros.eventoId } : {}),
          },
        },
      },
      ...(statusValido ? { status: statusValido } : {}),
      ...(filtros.busca
        ? {
            cliente: {
              pf: {
                OR: [
                  { nomeCompleto: { contains: filtros.busca, mode: 'insensitive' as const } },
                  { cpf: { contains: filtros.busca } },
                ],
              },
            },
          }
        : {}),
    };
  }

  async criarModalidade(
    usuarioId: string,
    eventoId: string,
    dto: CreateModalidadeDto,
  ) {
    const organizador = await this.getOrganizadorAprovadoOuFalhar(usuarioId);
    await this.getEventoDoOrganizadorOuFalhar(organizador.id, eventoId);

    return this.prisma.modalidade.create({ data: { ...dto, eventoId } });
  }

  async atualizarModalidade(
    usuarioId: string,
    eventoId: string,
    modalidadeId: string,
    dto: UpdateModalidadeDto,
  ) {
    const organizador = await this.getOrganizadorAprovadoOuFalhar(usuarioId);
    await this.getEventoDoOrganizadorOuFalhar(organizador.id, eventoId);
    await this.getModalidadeDoEventoOuFalhar(eventoId, modalidadeId);

    return this.prisma.modalidade.update({
      where: { id: modalidadeId },
      data: dto,
    });
  }

  async removerModalidade(
    usuarioId: string,
    eventoId: string,
    modalidadeId: string,
  ) {
    const organizador = await this.getOrganizadorAprovadoOuFalhar(usuarioId);
    await this.getEventoDoOrganizadorOuFalhar(organizador.id, eventoId);
    await this.getModalidadeDoEventoOuFalhar(eventoId, modalidadeId);

    try {
      await this.prisma.loteModalidadePreco.deleteMany({
        where: { modalidadeId },
      });
      await this.prisma.categoria.deleteMany({ where: { modalidadeId } });
      return await this.prisma.modalidade.delete({
        where: { id: modalidadeId },
      });
    } catch (error) {
      throw this.tratarErroDeVinculo(
        error,
        'Não é possível remover: já existe inscrição vinculada a essa modalidade.',
      );
    }
  }

  async criarCategoria(
    usuarioId: string,
    eventoId: string,
    modalidadeId: string,
    dto: CreateCategoriaDto,
  ) {
    const organizador = await this.getOrganizadorAprovadoOuFalhar(usuarioId);
    await this.getEventoDoOrganizadorOuFalhar(organizador.id, eventoId);
    await this.getModalidadeDoEventoOuFalhar(eventoId, modalidadeId);

    return this.prisma.categoria.create({ data: { ...dto, modalidadeId } });
  }

  async atualizarCategoria(
    usuarioId: string,
    eventoId: string,
    modalidadeId: string,
    categoriaId: string,
    dto: UpdateCategoriaDto,
  ) {
    const organizador = await this.getOrganizadorAprovadoOuFalhar(usuarioId);
    await this.getEventoDoOrganizadorOuFalhar(organizador.id, eventoId);
    await this.getModalidadeDoEventoOuFalhar(eventoId, modalidadeId);
    await this.getCategoriaDaModalidadeOuFalhar(modalidadeId, categoriaId);

    return this.prisma.categoria.update({
      where: { id: categoriaId },
      data: dto,
    });
  }

  async removerCategoria(
    usuarioId: string,
    eventoId: string,
    modalidadeId: string,
    categoriaId: string,
  ) {
    const organizador = await this.getOrganizadorAprovadoOuFalhar(usuarioId);
    await this.getEventoDoOrganizadorOuFalhar(organizador.id, eventoId);
    await this.getModalidadeDoEventoOuFalhar(eventoId, modalidadeId);
    await this.getCategoriaDaModalidadeOuFalhar(modalidadeId, categoriaId);

    try {
      return await this.prisma.categoria.delete({ where: { id: categoriaId } });
    } catch (error) {
      throw this.tratarErroDeVinculo(
        error,
        'Não é possível remover: já existe inscrição vinculada a essa categoria.',
      );
    }
  }

  async criarLote(usuarioId: string, eventoId: string, dto: CreateLoteDto) {
    const organizador = await this.getOrganizadorAprovadoOuFalhar(usuarioId);
    await this.getEventoDoOrganizadorOuFalhar(organizador.id, eventoId);
    this.validarPeriodo(dto.inicioVenda, dto.fimVenda);

    return this.prisma.lote.create({
      data: {
        ...dto,
        eventoId,
        inicioVenda: new Date(dto.inicioVenda),
        fimVenda: new Date(dto.fimVenda),
      },
    });
  }

  async atualizarLote(
    usuarioId: string,
    eventoId: string,
    loteId: string,
    dto: UpdateLoteDto,
  ) {
    const organizador = await this.getOrganizadorAprovadoOuFalhar(usuarioId);
    await this.getEventoDoOrganizadorOuFalhar(organizador.id, eventoId);
    const lote = await this.getLoteDoEventoOuFalhar(eventoId, loteId);

    this.validarPeriodo(
      dto.inicioVenda ?? lote.inicioVenda.toISOString(),
      dto.fimVenda ?? lote.fimVenda.toISOString(),
    );

    return this.prisma.lote.update({
      where: { id: loteId },
      data: {
        ...dto,
        ...(dto.inicioVenda ? { inicioVenda: new Date(dto.inicioVenda) } : {}),
        ...(dto.fimVenda ? { fimVenda: new Date(dto.fimVenda) } : {}),
      },
    });
  }

  async removerLote(usuarioId: string, eventoId: string, loteId: string) {
    const organizador = await this.getOrganizadorAprovadoOuFalhar(usuarioId);
    await this.getEventoDoOrganizadorOuFalhar(organizador.id, eventoId);
    await this.getLoteDoEventoOuFalhar(eventoId, loteId);

    try {
      await this.prisma.loteModalidadePreco.deleteMany({ where: { loteId } });
      return await this.prisma.lote.delete({ where: { id: loteId } });
    } catch (error) {
      throw this.tratarErroDeVinculo(
        error,
        'Não é possível remover: já existe inscrição vinculada a esse lote.',
      );
    }
  }

  async listarCupons(usuarioId: string, eventoId: string) {
    const organizador = await this.getOrganizadorOuFalhar(usuarioId);
    await this.getEventoDoOrganizadorOuFalhar(organizador.id, eventoId);

    return this.prisma.cupom.findMany({
      where: { eventoId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async criarCupom(usuarioId: string, eventoId: string, dto: CreateCupomDto) {
    const organizador = await this.getOrganizadorAprovadoOuFalhar(usuarioId);
    await this.getEventoDoOrganizadorOuFalhar(organizador.id, eventoId);

    try {
      return await this.prisma.cupom.create({
        data: {
          eventoId,
          codigo: dto.codigo.toUpperCase(),
          percentualDesconto: dto.percentualDesconto,
          quantidadeMaxima: dto.quantidadeMaxima,
          ...(dto.validoAte ? { validoAte: new Date(dto.validoAte) } : {}),
        },
      });
    } catch (error) {
      throw this.tratarErroDeUnicidade(
        error,
        'Já existe um cupom com esse código nesse evento.',
      );
    }
  }

  async removerCupom(usuarioId: string, eventoId: string, cupomId: string) {
    const organizador = await this.getOrganizadorAprovadoOuFalhar(usuarioId);
    await this.getEventoDoOrganizadorOuFalhar(organizador.id, eventoId);

    const cupom = await this.prisma.cupom.findUnique({ where: { id: cupomId } });
    if (!cupom || cupom.eventoId !== eventoId) {
      throw new NotFoundException('Cupom não encontrado.');
    }

    try {
      return await this.prisma.cupom.delete({ where: { id: cupomId } });
    } catch (error) {
      throw this.tratarErroDeVinculo(
        error,
        'Não é possível remover: já existe inscrição vinculada a esse cupom.',
      );
    }
  }

  async definirPreco(
    usuarioId: string,
    eventoId: string,
    loteId: string,
    modalidadeId: string,
    dto: DefinirPrecoDto,
  ) {
    const organizador = await this.getOrganizadorAprovadoOuFalhar(usuarioId);
    await this.getEventoDoOrganizadorOuFalhar(organizador.id, eventoId);
    await this.getLoteDoEventoOuFalhar(eventoId, loteId);
    await this.getModalidadeDoEventoOuFalhar(eventoId, modalidadeId);

    return this.prisma.loteModalidadePreco.upsert({
      where: { loteId_modalidadeId: { loteId, modalidadeId } },
      update: { valor: dto.valor },
      create: { loteId, modalidadeId, valor: dto.valor },
    });
  }

  private async getModalidadeDoEventoOuFalhar(
    eventoId: string,
    modalidadeId: string,
  ) {
    const modalidade = await this.prisma.modalidade.findUnique({
      where: { id: modalidadeId },
    });

    if (!modalidade || modalidade.eventoId !== eventoId) {
      throw new NotFoundException('Modalidade não encontrada.');
    }

    return modalidade;
  }

  private async getCategoriaDaModalidadeOuFalhar(
    modalidadeId: string,
    categoriaId: string,
  ) {
    const categoria = await this.prisma.categoria.findUnique({
      where: { id: categoriaId },
    });

    if (!categoria || categoria.modalidadeId !== modalidadeId) {
      throw new NotFoundException('Categoria não encontrada.');
    }

    return categoria;
  }

  private async getLoteDoEventoOuFalhar(eventoId: string, loteId: string) {
    const lote = await this.prisma.lote.findUnique({ where: { id: loteId } });

    if (!lote || lote.eventoId !== eventoId) {
      throw new NotFoundException('Lote não encontrado.');
    }

    return lote;
  }

  private tratarErroDeVinculo(error: unknown, mensagem: string) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    ) {
      return new ConflictException(mensagem);
    }
    return error;
  }

  private tratarErroDeUnicidade(error: unknown, mensagem: string) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ConflictException(mensagem);
    }
    return error;
  }

  private async getEventoDoOrganizadorOuFalhar(
    organizadorId: string,
    eventoId: string,
  ) {
    const evento = await this.prisma.evento.findUnique({
      where: { id: eventoId },
    });

    if (!evento || evento.organizadorId !== organizadorId) {
      throw new NotFoundException('Evento não encontrado.');
    }

    return evento;
  }

  private validarPeriodo(dataInicio: string, dataFim: string) {
    if (new Date(dataFim) < new Date(dataInicio)) {
      throw new BadRequestException(
        'A data de fim não pode ser antes da data de início.',
      );
    }
  }

  async atualizarFotoRosto(
    usuarioId: string,
    caminhoRelativo: string,
  ) {
    const organizador = await this.getOrganizadorOuFalhar(usuarioId);

    if (organizador.fotoRostoUrl) {
      unlink(
        join(process.cwd(), organizador.fotoRostoUrl),
      ).catch(() => undefined);
    }

    return this.prisma.organizador.update({
      where: { id: organizador.id },
      data: {
        fotoRostoUrl: caminhoRelativo,
        ...(organizador.status === StatusOrganizador.REJEITADO
          ? { status: StatusOrganizador.PENDENTE, motivoRevisao: null }
          : {}),
      },
    });
  }

  async atualizarDocumentoIdentidade(
    usuarioId: string,
    caminhoRelativo: string,
  ) {
    const organizador = await this.getOrganizadorOuFalhar(usuarioId);

    if (organizador.documentoIdentidadeUrl) {
      unlink(
        join(process.cwd(), organizador.documentoIdentidadeUrl),
      ).catch(() => undefined);
    }

    return this.prisma.organizador.update({
      where: { id: organizador.id },
      data: {
        documentoIdentidadeUrl: caminhoRelativo,
        ...(organizador.status === StatusOrganizador.REJEITADO
          ? { status: StatusOrganizador.PENDENTE, motivoRevisao: null }
          : {}),
      },
    });
  }

  async atualizarDadosBancarios(usuarioId: string, dto: UpdateDadosBancariosDto) {
    const organizador = await this.getOrganizadorOuFalhar(usuarioId);

    let asaasData = {};
    if (!organizador.asaasWalletId) {
      const cliente = await this.prisma.cliente.findUnique({
        where: { id: organizador.clienteId },
        include: { pf: true, pj: true, usuario: true },
      });

      const nome = cliente?.pf?.nomeCompleto || cliente?.pj?.razaoSocial || cliente?.usuario.email || 'Organizador Eventos';
      const cpfCnpj = cliente?.pf?.cpf || cliente?.pj?.cnpj || '00000000000';
      const email = cliente?.usuario.email || 'organizador@seupercurso.com.br';

      const asaasSub = await this.asaasService.criarSubcontaOrganizador({
        nome,
        email,
        cpfCnpj,
        chavePix: dto.chavePix,
      });

      asaasData = {
        asaasAccountId: asaasSub.accountId,
        asaasWalletId: asaasSub.walletId,
      };
    }

    return this.prisma.organizador.update({
      where: { id: organizador.id },
      data: {
        ...dto,
        ...asaasData,
      },
    });
  }

  async solicitarSaque(usuarioId: string, valor: number) {
    const organizador = await this.getOrganizadorAprovadoOuFalhar(usuarioId);

    const cliente = await this.prisma.cliente.findUnique({
      where: { id: organizador.clienteId },
      include: { pf: true, pj: true },
    });

    const cpfCnpjTitular = (cliente?.pf?.cpf || cliente?.pj?.cnpj || '').replace(/\D/g, '');

    if (!cpfCnpjTitular) {
      throw new BadRequestException('CPF ou CNPJ do titular não encontrado no cadastro.');
    }

    // Trava de Titularidade: A chave PIX deve obrigatoriamente corresponder ao CPF/CNPJ do organizador
    const chavePixOrganizador = (organizador.chavePix || cpfCnpjTitular).replace(/\D/g, '');

    // Se a chave for CPF/CNPJ numérico, verifica se bate rigorosamente com o titular
    if (chavePixOrganizador.length >= 11 && chavePixOrganizador !== cpfCnpjTitular) {
      throw new BadRequestException(
        `🔒 Trava de Segurança de Titularidade: Por conformidade bancária e fiscal, saques via PIX só são permitidos para contas do mesmo CPF/CNPJ do titular (${cliente?.pf?.cpf || cliente?.pj?.cnpj}). Não são permitidos saques para terceiros.`,
      );
    }

    const chaveDestinoFinal = organizador.chavePix || cpfCnpjTitular;

    const resSaque = await this.asaasService.solicitarSaquePix({
      valor,
      chavePix: chaveDestinoFinal,
      walletId: organizador.asaasWalletId,
    });

    return {
      sucesso: true,
      mensagem: `Saque de R$ ${valor.toFixed(2)} enviado para processamento via PIX com trava de titularidade ativada.`,
      transferId: resSaque.transferId,
      chaveDestino: `CPF/CNPJ Titular: ${cliente?.pf?.cpf || cliente?.pj?.cnpj} (${chaveDestinoFinal})`,
      valor,
    };
  }

  private async getOrganizadorOuFalhar(usuarioId: string) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { usuarioId },
      include: { organizador: true },
    });

    if (!cliente?.organizador) {
      throw new NotFoundException(
        'Você ainda não solicitou cadastro como organizador.',
      );
    }

    return cliente.organizador;
  }

  private async getOrganizadorAprovadoOuFalhar(usuarioId: string) {
    const organizador = await this.getOrganizadorOuFalhar(usuarioId);

    if (organizador.status !== StatusOrganizador.APROVADO) {
      throw new ForbiddenException(
        'Seu cadastro de organizador ainda não foi aprovado.',
      );
    }

    return organizador;
  }

  async gerarNumeracaoPeito(usuarioId: string, eventoId: string, numeroInicial: number = 101) {
    const organizador = await this.getOrganizadorAprovadoOuFalhar(usuarioId);

    const evento = await this.prisma.evento.findFirst({
      where: { id: eventoId, organizadorId: organizador.id },
    });
    if (!evento) {
      throw new NotFoundException('Evento não encontrado.');
    }

    const inscricoes = await this.prisma.inscricao.findMany({
      where: {
        categoria: { modalidade: { eventoId } },
        status: StatusInscricao.CONFIRMADA,
      },
      include: {
        cliente: { include: { pf: true } },
      },
      orderBy: [
        { categoria: { modalidade: { nome: 'asc' } } },
        { dataInscricao: 'asc' },
      ],
    });

    let proximoNumero = numeroInicial;
    let totalNumerados = 0;

    for (const inscricao of inscricoes) {
      await this.prisma.inscricao.update({
        where: { id: inscricao.id },
        data: { numeroPeito: String(proximoNumero) },
      });
      proximoNumero++;
      totalNumerados++;
    }

    return { totalNumerados, numeroInicial, numeroFinal: proximoNumero - 1 };
  }

  private async getOrganizadorPorIdAprovadoOuFalhar(organizadorId: string) {
    const organizador = await this.prisma.organizador.findUnique({
      where: { id: organizadorId },
    });

    if (!organizador) {
      throw new NotFoundException('Organizador não encontrado.');
    }
    if (organizador.status !== StatusOrganizador.APROVADO) {
      throw new ForbiddenException(
        'O cadastro do organizador não está mais aprovado.',
      );
    }

    return organizador;
  }

  async listarStaff(usuarioId: string) {
    const organizador = await this.getOrganizadorOuFalhar(usuarioId);

    return this.prisma.staff.findMany({
      where: { organizadorId: organizador.id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        nome: true,
        email: true,
        funcao: true,
        ativo: true,
        createdAt: true,
      },
    });
  }

  async criarStaff(usuarioId: string, dto: CreateStaffDto) {
    const organizador = await this.getOrganizadorAprovadoOuFalhar(usuarioId);

    const passwordHash = await bcrypt.hash(dto.senha, STAFF_SALT_ROUNDS);

    try {
      const staff = await this.prisma.staff.create({
        data: {
          organizadorId: organizador.id,
          nome: dto.nome,
          email: dto.email,
          funcao: dto.funcao,
          passwordHash,
        },
      });
      const { passwordHash: _omitido, ...staffPublico } = staff;
      return staffPublico;
    } catch (error) {
      throw this.tratarErroDeUnicidade(
        error,
        'Já existe um membro de equipe com esse e-mail.',
      );
    }
  }

  async atualizarStaff(usuarioId: string, staffId: string, dto: UpdateStaffDto) {
    const organizador = await this.getOrganizadorOuFalhar(usuarioId);
    await this.getStaffDoOrganizadorOuFalhar(organizador.id, staffId);

    const staff = await this.prisma.staff.update({
      where: { id: staffId },
      data: dto,
    });
    const { passwordHash: _omitido, ...staffPublico } = staff;
    return staffPublico;
  }

  async redefinirSenhaStaff(usuarioId: string, staffId: string, novaSenha: string) {
    const organizador = await this.getOrganizadorOuFalhar(usuarioId);
    await this.getStaffDoOrganizadorOuFalhar(organizador.id, staffId);

    const passwordHash = await bcrypt.hash(novaSenha, STAFF_SALT_ROUNDS);
    await this.prisma.staff.update({
      where: { id: staffId },
      data: { passwordHash },
    });

    return { sucesso: true };
  }

  async removerStaff(usuarioId: string, staffId: string) {
    const organizador = await this.getOrganizadorOuFalhar(usuarioId);
    await this.getStaffDoOrganizadorOuFalhar(organizador.id, staffId);

    await this.prisma.staff.delete({ where: { id: staffId } });
    return { sucesso: true };
  }

  private async getStaffDoOrganizadorOuFalhar(organizadorId: string, staffId: string) {
    const staff = await this.prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff || staff.organizadorId !== organizadorId) {
      throw new NotFoundException('Membro de equipe não encontrado.');
    }
    return staff;
  }
}
