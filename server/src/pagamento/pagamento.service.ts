import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StatusInscricao, StatusPagamento } from '../generated/prisma/enums';
import { calcularValorInscricao } from '../common/calcular-valor-inscricao';
import { CreatePagamentoDto } from './dto/create-pagamento.dto';

@Injectable()
export class PagamentoService {
  constructor(private readonly prisma: PrismaService) {}

  async create(usuarioId: string, dto: CreatePagamentoDto) {
    const clienteId = await this.getClienteIdOuFalhar(usuarioId);

    const inscricao = await this.prisma.inscricao.findUnique({
      where: { id: dto.inscricaoId },
      include: { categoria: { include: { modalidade: true } } },
    });
    if (!inscricao) {
      throw new NotFoundException('Inscrição não encontrada.');
    }
    if (inscricao.clienteId !== clienteId) {
      throw new ForbiddenException('Esta inscrição não pertence a você.');
    }

    if (inscricao.status === StatusInscricao.CONFIRMADA) {
      throw new ConflictException('Esta inscrição já está confirmada.');
    }
    if (inscricao.status !== StatusInscricao.PENDENTE_PAGAMENTO) {
      throw new BadRequestException(
        'Esta inscrição não está mais disponível para pagamento.',
      );
    }

    const pagamentoAprovado = await this.prisma.pagamento.findFirst({
      where: { inscricaoId: inscricao.id, status: StatusPagamento.APROVADO },
    });
    if (pagamentoAprovado) {
      throw new ConflictException(
        'Esta inscrição já tem um pagamento aprovado.',
      );
    }

    const valor = await calcularValorInscricao(this.prisma, {
      loteId: inscricao.loteId,
      modalidadeId: inscricao.categoria.modalidadeId,
      clienteId: inscricao.clienteId,
      eventoId: inscricao.categoria.modalidade.eventoId,
      cupomId: inscricao.cupomId,
    });

    return this.prisma.pagamento.create({
      data: {
        inscricaoId: inscricao.id,
        valor,
        metodo: dto.metodo,
        status: StatusPagamento.PENDENTE,
        gateway: 'simulado',
        codigoTransacao: randomUUID(),
      },
    });
  }

  async simularAprovacao(usuarioId: string, pagamentoId: string) {
    const pagamento = await this.buscarPagamentoDoClienteOuFalhar(
      usuarioId,
      pagamentoId,
    );

    const [pagamentoAtualizado] = await this.prisma.$transaction([
      this.prisma.pagamento.update({
        where: { id: pagamento.id },
        data: { status: StatusPagamento.APROVADO, dataPagamento: new Date() },
      }),
      this.prisma.inscricao.update({
        where: { id: pagamento.inscricaoId },
        data: { status: StatusInscricao.CONFIRMADA },
      }),
    ]);

    return pagamentoAtualizado;
  }

  async simularRecusa(usuarioId: string, pagamentoId: string) {
    const pagamento = await this.buscarPagamentoDoClienteOuFalhar(
      usuarioId,
      pagamentoId,
    );

    return this.prisma.pagamento.update({
      where: { id: pagamento.id },
      data: { status: StatusPagamento.RECUSADO },
    });
  }

  private async buscarPagamentoDoClienteOuFalhar(
    usuarioId: string,
    pagamentoId: string,
  ) {
    const clienteId = await this.getClienteIdOuFalhar(usuarioId);

    const pagamento = await this.prisma.pagamento.findUnique({
      where: { id: pagamentoId },
      include: { inscricao: true },
    });
    if (!pagamento) {
      throw new NotFoundException('Pagamento não encontrado.');
    }
    if (pagamento.inscricao.clienteId !== clienteId) {
      throw new ForbiddenException('Este pagamento não pertence a você.');
    }
    if (pagamento.status !== StatusPagamento.PENDENTE) {
      throw new BadRequestException('Este pagamento já foi processado.');
    }

    return pagamento;
  }

  private async getClienteIdOuFalhar(usuarioId: string): Promise<string> {
    const cliente = await this.prisma.cliente.findUnique({
      where: { usuarioId },
    });
    if (!cliente) {
      throw new NotFoundException(
        'Complete seu perfil (PF ou PJ) antes de pagar uma inscrição.',
      );
    }
    return cliente.id;
  }
}
