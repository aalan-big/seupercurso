import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import {
  StatusInscricao,
  StatusOrganizador,
  StatusResultado,
} from '../generated/prisma/enums';
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

const COMISSAO_PADRAO = 10;

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

@Injectable()
export class OrganizadorService {
  constructor(private readonly prisma: PrismaService) {}

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

    this.validarPeriodo(
      dto.dataInicio ?? evento.dataInicio.toISOString(),
      dto.dataFim ?? evento.dataFim.toISOString(),
    );

    return this.prisma.evento.update({
      where: { id: eventoId },
      data: {
        ...dto,
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
    await this.getEventoDoOrganizadorOuFalhar(organizador.id, eventoId);

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
    await this.getEventoDoOrganizadorOuFalhar(organizador.id, eventoId);

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

  async desfazerEntregaKit(usuarioId: string, eventoId: string, inscricaoId: string) {
    const organizador = await this.getOrganizadorAprovadoOuFalhar(usuarioId);
    await this.getEventoDoOrganizadorOuFalhar(organizador.id, eventoId);
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
}
