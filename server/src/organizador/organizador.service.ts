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
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import {
  StatusEvento,
  StatusInscricao,
  StatusOrganizador,
  StatusPagamento,
  StatusResultado,
  StatusSaque,
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
import { AuditLogService } from '../audit-log/audit-log.service';
import { CategoriaAuditLog, NivelAuditLog } from '../generated/prisma/enums';

@Injectable()
export class OrganizadorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly asaasService: AsaasService,
    private readonly auditLogService: AuditLogService,
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

    // O checkout agrupa inscrições em um Pedido, então o pagamento fica ligado ao
    // pedido e não à inscrição. Filtrar só por `inscricao` deixava de fora
    // praticamente todas as vendas reais.
    const eventoDoOrganizador = {
      categoria: { modalidade: { evento: { organizadorId: organizador.id } } },
    };
    const eventoSelect = {
      categoria: {
        select: {
          modalidade: {
            select: { evento: { select: { id: true, nome: true } } },
          },
        },
      },
    } as const;

    const pagamentos = await this.prisma.pagamento.findMany({
      where: {
        status: StatusPagamento.APROVADO,
        OR: [
          { inscricao: eventoDoOrganizador },
          { pedido: { inscricoes: { some: eventoDoOrganizador } } },
        ],
      },
      select: {
        valor: true,
        inscricao: { select: eventoSelect },
        pedido: {
          select: {
            inscricoes: { take: 1, select: eventoSelect },
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

      const evento = (pagamento.inscricao as any)?.categoria?.modalidade?.evento || (pagamento as any).pedido?.inscricoes?.[0]?.categoria?.modalidade?.evento;
      if (!evento) continue;
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

    // Saques já solicitados precisam sair do saldo — sem isso o mesmo repasse
    // poderia ser retirado várias vezes.
    const saquesAgregados = await this.prisma.saque.aggregate({
      where: {
        organizadorId: organizador.id,
        status: { in: [StatusSaque.PROCESSANDO, StatusSaque.CONCLUIDO] },
      },
      _sum: { valor: true },
    });

    const totalRepasse = totalArrecadado - comissaoPlataforma;
    const totalSacado = Number(saquesAgregados._sum.valor ?? 0);

    return {
      comissaoPercentual: percentual,
      totalArrecadado,
      comissaoPlataforma,
      totalRepasse,
      totalSacado,
      saldoDisponivel: Number(Math.max(0, totalRepasse - totalSacado).toFixed(2)),
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
        ...(dto.limiteTrocaCamisaAté
          ? { limiteTrocaCamisaAté: new Date(dto.limiteTrocaCamisaAté) }
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
      dto.status !== evento.status
    ) {
      if (dto.status === StatusEvento.FINALIZADO) {
        throw new ForbiddenException(
          'Só a equipe da plataforma pode finalizar um evento.',
        );
      }
      if (
        dto.status === StatusEvento.PUBLICADO &&
        evento.status !== StatusEvento.INSCRICOES_ENCERRADAS
      ) {
        throw new ForbiddenException(
          'Só a equipe da plataforma pode aprovar e publicar um novo evento pela primeira vez. Envie pra revisão (status "Aguardando aprovação") e aguarde.',
        );
      }
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
        ...(dto.limiteTrocaCamisaAté
          ? { limiteTrocaCamisaAté: new Date(dto.limiteTrocaCamisaAté) }
          : {}),
      },
    });
  }

  async atualizarMidiaEvento(
    usuarioId: string,
    eventoId: string,
    campo: 'bannerUrl' | 'regulamentoUrl',
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

  private async autoAtribuirNumerosPeito(eventoId: string) {
    const semNumero = await this.prisma.inscricao.findMany({
      where: {
        categoria: { modalidade: { eventoId } },
        status: StatusInscricao.CONFIRMADA,
        OR: [{ numeroPeito: null }, { numeroPeito: '' }],
      },
      orderBy: { dataInscricao: 'asc' },
    });

    if (semNumero.length === 0) return;

    const comNumero = await this.prisma.inscricao.findMany({
      where: {
        categoria: { modalidade: { eventoId } },
        numeroPeito: { not: null },
      },
      select: { numeroPeito: true },
    });

    let maxNum = 0;
    for (const item of comNumero) {
      if (!item.numeroPeito) continue;
      const num = parseInt(item.numeroPeito.replace(/\D/g, ''), 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }

    let proximoNumero = maxNum > 0 ? maxNum + 1 : 1;

    for (const inscricao of semNumero) {
      await this.prisma.inscricao.update({
        where: { id: inscricao.id },
        data: { numeroPeito: String(proximoNumero) },
      });
      proximoNumero++;
    }
  }

  async listarInscritos(usuarioId: string, filtros: FiltrosInscritos) {
    const organizador = await this.getOrganizadorOuFalhar(usuarioId);

    if (filtros.eventoId) {
      await this.autoAtribuirNumerosPeito(filtros.eventoId);
    } else {
      const eventos = await this.prisma.evento.findMany({
        where: { organizadorId: organizador.id },
        select: { id: true },
      });
      for (const ev of eventos) {
        await this.autoAtribuirNumerosPeito(ev.id);
      }
    }

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
        dependente: true,
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

    const res = await this.prisma.inscricao.update({
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

    if (res.categoria?.modalidade?.eventoId) {
      await this.autoAtribuirNumerosPeito(res.categoria.modalidade.eventoId);
    }

    return res;
  }

  async exportarInscritosXlsx(
    usuarioId: string,
    filtros: FiltrosInscritos,
  ): Promise<Buffer> {
    const inscritos = await this.listarInscritos(usuarioId, filtros);

    const statusLabel: Record<string, string> = {
      PENDENTE_PAGAMENTO: 'Pagamento pendente',
      CONFIRMADA: 'Confirmada',
      CANCELADA: 'Cancelada',
      EXPIRADA: 'Expirada',
    };

    const workbook = new ExcelJS.Workbook();
    const planilha = workbook.addWorksheet('Inscritos');

    planilha.columns = [
      { header: 'Nome do Atleta', key: 'nome', width: 28 },
      { header: 'CPF do Atleta', key: 'cpf', width: 16 },
      { header: 'Comprador / Titular', key: 'comprador', width: 26 },
      { header: 'E-mail Comprador', key: 'email', width: 28 },
      { header: 'Celular', key: 'celular', width: 16 },
      { header: 'Evento', key: 'evento', width: 24 },
      { header: 'Modalidade', key: 'modalidade', width: 18 },
      { header: 'Categoria', key: 'categoria', width: 16 },
      { header: 'Numero do peito', key: 'numeroPeito', width: 15 },
      { header: 'Tamanho da camisa', key: 'tamanhoCamisa', width: 15 },
      { header: 'Status', key: 'status', width: 18 },
      { header: 'Data da inscricao', key: 'dataInscricao', width: 20 },
    ];

    planilha.getRow(1).font = { bold: true };
    planilha.getRow(1).alignment = { vertical: 'middle' };
    planilha.views = [{ state: 'frozen', ySplit: 1 }];

    for (const inscricao of inscritos) {
      const nomeAtleta =
        inscricao.dependente?.nomeCompleto ??
        inscricao.atletaNome ??
        inscricao.cliente.pf?.nomeCompleto ??
        inscricao.cliente.pj?.razaoSocial ??
        '';
      const cpfAtleta =
        inscricao.dependente?.cpf ??
        inscricao.atletaCpf ??
        inscricao.cliente.pf?.cpf ??
        '';
      const comprador = inscricao.cliente.pf?.nomeCompleto || inscricao.cliente.usuario.email;

      const linha = planilha.addRow({
        nome: nomeAtleta,
        cpf: this.formatarCpfParaExport(cpfAtleta),
        comprador,
        email: inscricao.cliente.usuario.email,
        celular: inscricao.cliente.pf?.celular ?? '',
        evento: inscricao.categoria.modalidade.evento.nome,
        modalidade: inscricao.categoria.modalidade.nome,
        categoria: inscricao.categoria.nome,
        numeroPeito: inscricao.numeroPeito ?? '',
        tamanhoCamisa: inscricao.tamanhoCamisa ?? '',
        status: statusLabel[inscricao.status] ?? inscricao.status,
        dataInscricao: inscricao.dataInscricao.toLocaleString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
      });

      // Trava a coluna do CPF como texto — mesmo sem pontuação, o Excel nunca
      // tenta interpretar como número (evita a notação científica 8,25E+10).
      linha.getCell('cpf').numFmt = '@';
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private formatarCpfParaExport(cpf: string): string {
    const digitos = cpf.replace(/\D/g, '');
    if (digitos.length !== 11) return cpf;
    return digitos.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  async exportarInscritosPdf(
    usuarioId: string,
    filtros: FiltrosInscritos,
  ): Promise<Buffer> {
    const inscritos = await this.listarInscritos(usuarioId, filtros);

    // Lista de largada: ordena por percurso e depois por número de peito,
    // que é a ordem que faz sentido pra conferir na hora do check-in/prova.
    const ordenados = [...inscritos].sort((a, b) => {
      const modA = a.categoria.modalidade.nome;
      const modB = b.categoria.modalidade.nome;
      if (modA !== modB) return modA.localeCompare(modB, 'pt-BR');
      const peitoA = a.numeroPeito ? Number(a.numeroPeito) : Infinity;
      const peitoB = b.numeroPeito ? Number(b.numeroPeito) : Infinity;
      return peitoA - peitoB;
    });

    const nomeEvento =
      ordenados[0]?.categoria.modalidade.evento.nome || 'Lista de Inscritos';

    const colunas = [
      { titulo: 'Nº', largura: 32 },
      { titulo: 'Nome do Atleta', largura: 165 },
      { titulo: 'CPF', largura: 85 },
      { titulo: 'Modalidade', largura: 85 },
      { titulo: 'Categoria', largura: 78 },
      { titulo: 'Camisa', largura: 48 },
    ];
    const margem = 40;
    const larguraTabela = colunas.reduce((acc, c) => acc + c.largura, 0);
    const alturaLinha = 20;

    const doc = new PDFDocument({ size: 'A4', margin: margem });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    const fimPromise = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    const desenharCabecalhoTabela = (y: number) => {
      doc.rect(margem, y, larguraTabela, alturaLinha).fill('#0f172a');
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9);
      let x = margem;
      for (const col of colunas) {
        doc.text(col.titulo, x + 4, y + 6, { width: col.largura - 8, ellipsis: true });
        x += col.largura;
      }
      doc.fillColor('#000000').font('Helvetica');
      return y + alturaLinha;
    };

    doc.font('Helvetica-Bold').fontSize(16).text(nomeEvento, margem, margem);
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#64748b')
      .text(
        `Lista de largada — gerada em ${new Date().toLocaleString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
        })} — ${ordenados.length} inscrito(s)`,
        margem,
        margem + 22,
      );
    doc.fillColor('#000000');

    let y = margem + 50;
    y = desenharCabecalhoTabela(y);

    const alturaUtil = doc.page.height - margem;

    ordenados.forEach((inscricao, indice) => {
      if (y + alturaLinha > alturaUtil) {
        doc.addPage();
        y = margem;
        y = desenharCabecalhoTabela(y);
      }

      if (indice % 2 === 1) {
        doc.rect(margem, y, larguraTabela, alturaLinha).fill('#f8fafc');
        doc.fillColor('#000000');
      }

      const nomeAtleta =
        inscricao.dependente?.nomeCompleto ??
        inscricao.atletaNome ??
        inscricao.cliente.pf?.nomeCompleto ??
        inscricao.cliente.pj?.razaoSocial ??
        '';
      const cpfAtleta =
        inscricao.dependente?.cpf ??
        inscricao.atletaCpf ??
        inscricao.cliente.pf?.cpf ??
        '';

      const valores = [
        inscricao.numeroPeito ?? '—',
        nomeAtleta,
        this.formatarCpfParaExport(cpfAtleta),
        inscricao.categoria.modalidade.nome,
        inscricao.categoria.nome,
        inscricao.tamanhoCamisa ?? '—',
      ];

      doc.fontSize(8.5);
      let x = margem;
      valores.forEach((valor, i) => {
        doc.text(String(valor), x + 4, y + 6, {
          width: colunas[i].largura - 8,
          ellipsis: true,
        });
        x += colunas[i].largura;
      });

      y += alturaLinha;
    });

    doc.end();
    return fimPromise;
  }

  private whereInscritos(organizadorId: string, filtros: FiltrosInscritos) {
    const statusValido =
      filtros.status &&
      Object.values(StatusInscricao).includes(
        filtros.status as StatusInscricao,
      )
        ? (filtros.status as StatusInscricao)
        : undefined;

    const busca = filtros.busca?.trim();

    return {
      categoria: {
        modalidade: {
          evento: {
            organizadorId,
            ...(filtros.eventoId ? { id: filtros.eventoId } : {}),
          },
        },
      },
      status: statusValido
        ? statusValido
        : { notIn: [StatusInscricao.CANCELADA, StatusInscricao.EXPIRADA] },
      ...(busca
        ? {
            OR: [
              { numeroPeito: { contains: busca, mode: 'insensitive' as const } },
              { atletaNome: { contains: busca, mode: 'insensitive' as const } },
              { atletaCpf: { contains: busca } },
              { dependente: { nomeCompleto: { contains: busca, mode: 'insensitive' as const } } },
              { dependente: { cpf: { contains: busca } } },
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

    const { valor, ...modalidadeData } = dto;
    const modalidade = await this.prisma.modalidade.create({ data: { ...modalidadeData, eventoId } });

    // Auto-cria categoria padrão Geral
    await this.prisma.categoria.create({
      data: {
        modalidadeId: modalidade.id,
        nome: 'Geral',
        genero: 'LIVRE',
        pcd: false,
      },
    });

    // Se o evento não possui nenhum lote ainda, auto-cria o "1º Lote"
    const lotes = await this.prisma.lote.findMany({ where: { eventoId }, orderBy: { createdAt: 'asc' } });
    let lotePrincipal = lotes[0];
    if (!lotePrincipal) {
      const evento = await this.prisma.evento.findUnique({ where: { id: eventoId } });
      const agora = new Date();
      const fim = evento?.dataFim || new Date(agora.getTime() + 60 * 24 * 60 * 60 * 1000);
      lotePrincipal = await this.prisma.lote.create({
        data: {
          eventoId,
          nome: '1º Lote',
          inicioVenda: agora,
          fimVenda: fim,
        },
      });
    }

    // Se veio um valor, salva no lote principal
    if (valor !== undefined && valor !== null && lotePrincipal) {
      await this.prisma.loteModalidadePreco.upsert({
        where: { loteId_modalidadeId: { loteId: lotePrincipal.id, modalidadeId: modalidade.id } },
        update: { valor },
        create: { loteId: lotePrincipal.id, modalidadeId: modalidade.id, valor },
      });
    }

    return modalidade;
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

    const { valor, ...modalidadeData } = dto;

    if (valor !== undefined && valor !== null) {
      const lotes = await this.prisma.lote.findMany({ where: { eventoId }, orderBy: { createdAt: 'asc' } });
      let lotePrincipal = lotes[0];
      if (!lotePrincipal) {
        const evento = await this.prisma.evento.findUnique({ where: { id: eventoId } });
        const agora = new Date();
        const fim = evento?.dataFim || new Date(agora.getTime() + 60 * 24 * 60 * 60 * 1000);
        lotePrincipal = await this.prisma.lote.create({
          data: {
            eventoId,
            nome: '1º Lote',
            inicioVenda: agora,
            fimVenda: fim,
          },
        });
      }

      if (lotePrincipal) {
        await this.prisma.loteModalidadePreco.upsert({
          where: { loteId_modalidadeId: { loteId: lotePrincipal.id, modalidadeId } },
          update: { valor },
          create: { loteId: lotePrincipal.id, modalidadeId, valor },
        });
      }
    }

    return this.prisma.modalidade.update({
      where: { id: modalidadeId },
      data: modalidadeData,
    });
  }

  async atualizarMidiaModalidade(
    usuarioId: string,
    eventoId: string,
    modalidadeId: string,
    caminhoRelativo: string,
  ) {
    const organizador = await this.getOrganizadorAprovadoOuFalhar(usuarioId);
    await this.getEventoDoOrganizadorOuFalhar(organizador.id, eventoId);
    const modalidade = await this.getModalidadeDoEventoOuFalhar(
      eventoId,
      modalidadeId,
    );

    if (modalidade.mapaPercursoUrl?.startsWith('/uploads/')) {
      unlink(join(process.cwd(), modalidade.mapaPercursoUrl)).catch(
        () => undefined,
      );
    }

    return this.prisma.modalidade.update({
      where: { id: modalidadeId },
      data: { mapaPercursoUrl: caminhoRelativo },
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

    if (
      organizador.status === StatusOrganizador.APROVADO ||
      (organizador.status === StatusOrganizador.PENDENTE &&
        organizador.fotoRostoUrl &&
        organizador.documentoIdentidadeUrl)
    ) {
      throw new BadRequestException(
        'Seus documentos já foram enviados e estão em análise ou aprovados. O envio fica bloqueado a menos que o Administrador solicite revisão.',
      );
    }

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

    if (
      organizador.status === StatusOrganizador.APROVADO ||
      (organizador.status === StatusOrganizador.PENDENTE &&
        organizador.fotoRostoUrl &&
        organizador.documentoIdentidadeUrl)
    ) {
      throw new BadRequestException(
        'Seus documentos já foram enviados e estão em análise ou aprovados. O envio fica bloqueado a menos que o Administrador solicite revisão.',
      );
    }

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

    await this.prisma.organizador.update({
      where: { id: organizador.id },
      data: { ...dto },
    });

    // A subconta Asaas só é criada depois que o admin aprovar o organizador.
    return this.garantirSubcontaAsaas(organizador.id);
  }

  // Cria a subconta Asaas assim que o organizador estiver aprovado e já tiver dados bancários salvos.
  // Chamado tanto ao salvar dados bancários quanto no momento em que o admin aprova o cadastro.
  async garantirSubcontaAsaas(organizadorId: string) {
    const organizador = await this.prisma.organizador.findUnique({
      where: { id: organizadorId },
    });
    if (!organizador) {
      throw new NotFoundException('Organizador não encontrado.');
    }

    const temDadosBancarios = !!(organizador.chavePix || organizador.conta);
    if (
      organizador.asaasWalletId ||
      organizador.status !== StatusOrganizador.APROVADO ||
      !temDadosBancarios
    ) {
      return organizador;
    }

    const cliente = await this.prisma.cliente.findUnique({
      where: { id: organizador.clienteId },
      include: { pf: true, pj: true, usuario: true, enderecos: true },
    });

    const nome = cliente?.pf?.nomeCompleto || cliente?.pj?.razaoSocial || cliente?.usuario.email || 'Organizador Eventos';
    const cpfCnpj = cliente?.pf?.cpf || cliente?.pj?.cnpj || '00000000000';
    const email = cliente?.usuario.email || 'organizador@seupercurso.com.br';
    const endereco = cliente?.enderecos[0];

    const asaasSub = await this.asaasService.criarSubcontaOrganizador({
      nome,
      email,
      cpfCnpj,
      chavePix: organizador.chavePix ?? undefined,
      telefone: cliente?.pf?.celular || cliente?.pj?.celularComercial,
      dataNascimento: cliente?.pf?.dataNascimento?.toISOString().slice(0, 10),
      cep: endereco?.cep,
      logradouro: endereco?.logradouro,
      numero: endereco?.numero,
      complemento: endereco?.complemento ?? undefined,
      bairro: endereco?.bairro,
    });

    return this.prisma.organizador.update({
      where: { id: organizador.id },
      data: {
        asaasAccountId: asaasSub.accountId,
        asaasWalletId: asaasSub.walletId,
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

    if (!Number.isFinite(valor) || valor <= 0) {
      throw new BadRequestException('Informe um valor de saque válido.');
    }

    // Trava de saldo: antes o valor não era confrontado com o repasse disponível,
    // então qualquer quantia podia ser solicitada.
    const financeiro = await this.obterFinanceiro(usuarioId);
    const valorArredondado = Number(valor.toFixed(2));

    if (valorArredondado > financeiro.saldoDisponivel) {
      throw new BadRequestException(
        `Saldo insuficiente. Disponível para saque: R$ ${financeiro.saldoDisponivel.toFixed(2)}.`,
      );
    }

    // Registra o saque antes de chamar o gateway para que o saldo já fique
    // reservado — duas solicitações simultâneas não podem sacar o mesmo dinheiro.
    const saque = await this.prisma.saque.create({
      data: {
        organizadorId: organizador.id,
        valor: valorArredondado,
        chaveDestino: chaveDestinoFinal,
        status: StatusSaque.PROCESSANDO,
      },
    });

    let resSaque: { transferId: string; status: string; valor: number };
    try {
      resSaque = await this.asaasService.solicitarSaquePix({
        valor: valorArredondado,
        chavePix: chaveDestinoFinal,
        walletId: organizador.asaasWalletId,
      });
    } catch (err) {
      // Libera o saldo reservado: saques FALHOU não entram no total sacado.
      await this.prisma.saque.update({
        where: { id: saque.id },
        data: {
          status: StatusSaque.FALHOU,
          motivoFalha: err instanceof Error ? err.message : String(err),
        },
      });

      this.auditLogService.log({
        categoria: CategoriaAuditLog.FINANCEIRO,
        nivel: NivelAuditLog.ERROR,
        mensagem: `Falha ao processar saque PIX de R$ ${valorArredondado.toFixed(2)}`,
        detalhes: {
          saqueId: saque.id,
          organizadorId: organizador.id,
          erro: err instanceof Error ? err.message : String(err),
        },
        usuarioId,
      });

      throw err;
    }

    await this.prisma.saque.update({
      where: { id: saque.id },
      data: { status: StatusSaque.CONCLUIDO, transferId: resSaque.transferId },
    });

    this.auditLogService.log({
      categoria: CategoriaAuditLog.FINANCEIRO,
      nivel: NivelAuditLog.SUCCESS,
      mensagem: `Solicitação de Saque PIX de R$ ${valorArredondado.toFixed(2)} processada`,
      detalhes: {
        valor: valorArredondado,
        saqueId: saque.id,
        transferId: resSaque.transferId,
        chaveDestino: chaveDestinoFinal,
        saldoRestante: Number(
          (financeiro.saldoDisponivel - valorArredondado).toFixed(2),
        ),
        organizadorId: organizador.id,
      },
      usuarioId,
    });

    return {
      sucesso: true,
      mensagem: `Saque de R$ ${valorArredondado.toFixed(2)} enviado para processamento via PIX com trava de titularidade ativada.`,
      transferId: resSaque.transferId,
      chaveDestino: `CPF/CNPJ Titular: ${cliente?.pf?.cpf || cliente?.pj?.cnpj} (${chaveDestinoFinal})`,
      valor: valorArredondado,
      saldoRestante: Number(
        (financeiro.saldoDisponivel - valorArredondado).toFixed(2),
      ),
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
