import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StatusInscricao } from '../generated/prisma/enums';
import { calcularValorInscricao } from '../common/calcular-valor-inscricao';
import { calcularIdade } from '../common/calcular-idade';
import { CreateInscricaoDto } from './dto/create-inscricao.dto';

@Injectable()
export class InscricaoService {
  constructor(private readonly prisma: PrismaService) {}

  async create(usuarioId: string, dto: CreateInscricaoDto) {
    const cliente = await this.getClienteComPfOuFalhar(usuarioId);
    const clienteId = cliente.id;

    const categoria = await this.prisma.categoria.findUnique({
      where: { id: dto.categoriaId },
      include: { modalidade: { include: { evento: true } } },
    });
    if (!categoria) {
      throw new NotFoundException('Categoria não encontrada.');
    }

    this.validarElegibilidadeCategoria(
      categoria,
      cliente.pf,
      categoria.modalidade.evento.dataInicio,
    );

    const loteRequisitado = await this.prisma.lote.findUnique({
      where: { id: dto.loteId },
    });
    if (!loteRequisitado) {
      throw new NotFoundException('Lote não encontrado.');
    }

    if (categoria.modalidade.eventoId !== loteRequisitado.eventoId) {
      throw new BadRequestException(
        'A categoria e o lote precisam ser do mesmo evento.',
      );
    }

    const lote = await this.resolverLoteDisponivel(
      loteRequisitado.eventoId,
      categoria.modalidadeId,
    );

    const inscricaoAtiva = await this.prisma.inscricao.findFirst({
      where: {
        clienteId,
        status: {
          notIn: [StatusInscricao.CANCELADA, StatusInscricao.EXPIRADA],
        },
        categoria: { modalidade: { eventoId: lote.eventoId } },
      },
    });
    if (inscricaoAtiva) {
      throw new ConflictException(
        'Você já tem uma inscrição ativa para este evento.',
      );
    }

    const cupomId = dto.cupomCodigo
      ? await this.resolverCupomOuFalhar(lote.eventoId, dto.cupomCodigo)
      : null;

    const valor = await calcularValorInscricao(this.prisma, {
      loteId: lote.id,
      modalidadeId: categoria.modalidadeId,
      clienteId,
      eventoId: lote.eventoId,
      cupomId,
    });

    const inscricao = await this.prisma.$transaction(async (tx) => {
      if (cupomId) {
        await tx.cupom.update({
          where: { id: cupomId },
          data: { usosAtuais: { increment: 1 } },
        });
      }

      return tx.inscricao.create({
        data: {
          clienteId,
          categoriaId: dto.categoriaId,
          loteId: lote.id,
          cupomId,
          tamanhoCamisa: dto.tamanhoCamisa,
          status: StatusInscricao.PENDENTE_PAGAMENTO,
        },
      });
    });

    return { ...inscricao, valor };
  }

  async findMinhas(usuarioId: string) {
    const clienteId = await this.getClienteIdOuFalhar(usuarioId);

    return this.prisma.inscricao.findMany({
      where: { clienteId },
      include: {
        categoria: {
          include: {
            modalidade: {
              include: {
                evento: {
                  include: {
                    modalidades: {
                      include: {
                        categorias: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        lote: true,
        pagamentos: { orderBy: { createdAt: 'desc' } },
        resultado: true,
        certificado: true,
      },
      orderBy: { dataInscricao: 'desc' },
    });
  }

  async cancelar(usuarioId: string, inscricaoId: string) {
    const clienteId = await this.getClienteIdOuFalhar(usuarioId);

    const inscricao = await this.prisma.inscricao.findUnique({
      where: { id: inscricaoId },
    });

    if (!inscricao || inscricao.clienteId !== clienteId) {
      throw new NotFoundException('Inscrição não encontrada.');
    }

    if (inscricao.status !== StatusInscricao.PENDENTE_PAGAMENTO) {
      throw new BadRequestException(
        'Só é possível cancelar inscrições com pagamento pendente.',
      );
    }

  return this.prisma.inscricao.update({
      where: { id: inscricaoId },
      data: { status: StatusInscricao.CANCELADA },
    });
  }

  async atualizarTamanhoCamisa(
    usuarioId: string,
    inscricaoId: string,
    tamanhoCamisa: string,
  ) {
    const clienteId = await this.getClienteIdOuFalhar(usuarioId);

    const inscricao = await this.prisma.inscricao.findUnique({
      where: { id: inscricaoId },
      include: {
        categoria: { include: { modalidade: { include: { evento: true } } } },
      },
    });

    if (!inscricao || inscricao.clienteId !== clienteId) {
      throw new NotFoundException('Inscrição não encontrada.');
    }

    if (inscricao.kitEntregueEm) {
      throw new BadRequestException(
        'O kit já foi retirado e o tamanho da camisa não pode mais ser alterado.',
      );
    }

    const evento = inscricao.categoria.modalidade.evento;
    const agora = new Date();
    if (
      evento.camisasBloqueadas ||
      (evento.limiteTrocaCamisaAté && evento.limiteTrocaCamisaAté < agora)
    ) {
      throw new BadRequestException(
        'As camisetas deste evento já foram enviadas para a gráfica/produção e o tamanho não pode mais ser alterado.',
      );
    }

    return this.prisma.inscricao.update({
      where: { id: inscricaoId },
      data: { tamanhoCamisa },
    });
  }

  async trocarCategoria(
    usuarioId: string,
    inscricaoId: string,
    novaCategoriaId: string,
  ) {
    const cliente = await this.getClienteComPfOuFalhar(usuarioId);
    const clienteId = cliente.id;

    const inscricao = await this.prisma.inscricao.findUnique({
      where: { id: inscricaoId },
      include: {
        categoria: { include: { modalidade: { include: { evento: true } } } },
      },
    });

    if (!inscricao || inscricao.clienteId !== clienteId) {
      throw new NotFoundException('Inscrição não encontrada.');
    }

    if (inscricao.kitEntregueEm) {
      throw new BadRequestException(
        'O kit já foi retirado e a modalidade não pode mais ser alterada.',
      );
    }

    const evento = inscricao.categoria.modalidade.evento;
    const agora = new Date();
    if (
      evento.camisasBloqueadas ||
      (evento.limiteTrocaCamisaAté && evento.limiteTrocaCamisaAté < agora)
    ) {
      throw new BadRequestException(
        'As alterações de modalidade e kit deste evento já foram encerradas pelo organizador para a produção dos kits.',
      );
    }

    const novaCategoria = await this.prisma.categoria.findUnique({
      where: { id: novaCategoriaId },
      include: { modalidade: { include: { evento: true } } },
    });

    if (!novaCategoria) {
      throw new NotFoundException('Nova categoria não encontrada.');
    }

    if (
      novaCategoria.modalidade.eventoId !==
      inscricao.categoria.modalidade.eventoId
    ) {
      throw new BadRequestException(
        'A nova modalidade precisa ser do mesmo evento.',
      );
    }

    this.validarElegibilidadeCategoria(
      novaCategoria,
      cliente.pf,
      novaCategoria.modalidade.evento.dataInicio,
    );

    return this.prisma.inscricao.update({
      where: { id: inscricaoId },
      data: { categoriaId: novaCategoriaId },
    });
  }

  async transferirInscricao(
    usuarioId: string,
    inscricaoId: string,
    emailDestino: string,
  ) {
    const clienteId = await this.getClienteIdOuFalhar(usuarioId);

    const inscricao = await this.prisma.inscricao.findUnique({
      where: { id: inscricaoId },
      include: {
        categoria: { include: { modalidade: { include: { evento: true } } } },
      },
    });

    if (!inscricao || inscricao.clienteId !== clienteId) {
      throw new NotFoundException('Inscrição não encontrada.');
    }

    if (inscricao.status === StatusInscricao.CANCELADA || inscricao.status === StatusInscricao.EXPIRADA) {
      throw new BadRequestException(
        'Inscrições canceladas ou expiradas não podem ser transferidas.',
      );
    }

    if (inscricao.kitEntregueEm) {
      throw new BadRequestException(
        'O kit desta inscrição já foi retirado e ela não pode mais ser transferida.',
      );
    }

    if (!inscricao.categoria.modalidade.evento.permiteTransferencia) {
      throw new BadRequestException(
        'Este evento não permite transferência de titulares.',
      );
    }

    const usuarioDestino = await this.prisma.usuario.findUnique({
      where: { email: emailDestino.toLowerCase().trim() },
      include: { cliente: true },
    });

    if (!usuarioDestino || !usuarioDestino.cliente) {
      throw new NotFoundException(
        `O atleta com e-mail "${emailDestino}" não possui cadastro na plataforma. Peça para ele criar uma conta primeiro!`,
      );
    }

    if (usuarioDestino.cliente.id === clienteId) {
      throw new BadRequestException('Você não pode transferir a inscrição para você mesmo.');
    }

    return this.prisma.inscricao.update({
      where: { id: inscricaoId },
      data: {
        clienteId: usuarioDestino.cliente.id,
        numeroPeito: null, // reseta o número de peito para reassociação
      },
    });
  }

  // Garante que o atleta realmente se encaixa nas regras da categoria
  // (idade na data do evento, gênero e PCD) antes de deixar a inscrição seguir.
  private validarElegibilidadeCategoria(
    categoria: {
      idadeMinima: number | null;
      idadeMaxima: number | null;
      genero: string;
      pcd: boolean;
    },
    pf: { dataNascimento: Date; genero: string; pcd: boolean } | null,
    dataEvento: Date,
  ) {
    if (!pf) {
      throw new BadRequestException(
        'Complete seu perfil de pessoa física antes de se inscrever.',
      );
    }

    if (categoria.idadeMinima !== null || categoria.idadeMaxima !== null) {
      const idade = calcularIdade(pf.dataNascimento, dataEvento);
      if (categoria.idadeMinima !== null && idade < categoria.idadeMinima) {
        throw new BadRequestException(
          `Essa categoria exige idade mínima de ${categoria.idadeMinima} anos na data do evento.`,
        );
      }
      if (categoria.idadeMaxima !== null && idade > categoria.idadeMaxima) {
        throw new BadRequestException(
          `Essa categoria é só até ${categoria.idadeMaxima} anos na data do evento.`,
        );
      }
    }

    if (categoria.genero !== 'LIVRE' && categoria.genero !== pf.genero) {
      throw new BadRequestException(
        'Essa categoria não corresponde ao gênero informado no seu perfil.',
      );
    }

    if (categoria.pcd && !pf.pcd) {
      throw new BadRequestException(
        'Essa categoria é exclusiva pra pessoas com deficiência (PCD).',
      );
    }
  }

  // Escolhe, entre os lotes do evento com preço definido pra essa modalidade
  // e dentro da própria janela de venda, o mais antigo que ainda tem vaga —
  // isso implementa a "virada automática" quando um lote esgota por quantidade.
  private async resolverLoteDisponivel(eventoId: string, modalidadeId: string) {
    const agora = new Date();

    const lotes = await this.prisma.lote.findMany({
      where: {
        eventoId,
        inicioVenda: { lte: agora },
        fimVenda: { gte: agora },
        precos: { some: { modalidadeId } },
      },
      include: {
        _count: {
          select: {
            inscricoes: {
              where: {
                status: {
                  notIn: [StatusInscricao.CANCELADA, StatusInscricao.EXPIRADA],
                },
              },
            },
          },
        },
      },
      orderBy: { inicioVenda: 'asc' },
    });

    const disponivel = lotes.find(
      (lote) => lote.quantidade === null || lote._count.inscricoes < lote.quantidade,
    );

    if (!disponivel) {
      throw new BadRequestException(
        'Não há vagas disponíveis pra essa modalidade no momento.',
      );
    }

    return disponivel;
  }

  private async resolverCupomOuFalhar(eventoId: string, codigo: string) {
    const codigoLimpo = codigo.trim();
    if (!codigoLimpo) {
      throw new BadRequestException('Informe o código do cupom.');
    }

    const cupom = await this.prisma.cupom.findFirst({
      where: {
        eventoId,
        codigo: { equals: codigoLimpo, mode: 'insensitive' },
      },
    });

    if (!cupom) {
      throw new BadRequestException(`Cupom "${codigoLimpo}" não foi encontrado para este evento.`);
    }
    if (!cupom.ativo) {
      throw new BadRequestException('Este cupom está inativo no momento.');
    }
    if (cupom.validoAte && cupom.validoAte < new Date()) {
      throw new BadRequestException('Este cupom expirou.');
    }
    if (
      cupom.quantidadeMaxima !== null &&
      cupom.usosAtuais >= cupom.quantidadeMaxima
    ) {
      throw new BadRequestException('Este cupom já atingiu o limite máximo de usos.');
    }

    return cupom.id;
  }

  private async getClienteComPfOuFalhar(usuarioId: string) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { usuarioId },
      include: { pf: true },
    });
    if (!cliente) {
      throw new NotFoundException(
        'Complete seu perfil (PF ou PJ) antes de se inscrever em um evento.',
      );
    }
    return cliente;
  }

  private async getClienteIdOuFalhar(usuarioId: string): Promise<string> {
    const cliente = await this.prisma.cliente.findUnique({
      where: { usuarioId },
    });
    if (!cliente) {
      throw new NotFoundException(
        'Complete seu perfil (PF ou PJ) antes de se inscrever em um evento.',
      );
    }
    return cliente.id;
  }
}
