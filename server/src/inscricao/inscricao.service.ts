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
        categoria: { include: { modalidade: { include: { evento: true } } } },
        lote: true,
        pagamentos: { orderBy: { createdAt: 'desc' } },
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
    const cupom = await this.prisma.cupom.findUnique({
      where: { eventoId_codigo: { eventoId, codigo: codigo.toUpperCase() } },
    });

    if (!cupom || !cupom.ativo) {
      throw new BadRequestException('Cupom inválido.');
    }
    if (cupom.validoAte && cupom.validoAte < new Date()) {
      throw new BadRequestException('Este cupom expirou.');
    }
    if (
      cupom.quantidadeMaxima !== null &&
      cupom.usosAtuais >= cupom.quantidadeMaxima
    ) {
      throw new BadRequestException('Este cupom já atingiu o limite de usos.');
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
