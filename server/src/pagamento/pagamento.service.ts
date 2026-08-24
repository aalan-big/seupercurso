import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StatusInscricao, StatusPagamento, MetodoPagamento } from '../generated/prisma/enums';
import { calcularValorInscricao } from '../common/calcular-valor-inscricao';
import { CreatePagamentoDto } from './dto/create-pagamento.dto';

import { AsaasService } from './asaas.service';

import { EmailService } from '../email/email.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CategoriaAuditLog, NivelAuditLog } from '../generated/prisma/enums';

@Injectable()
export class PagamentoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly asaasService: AsaasService,
    private readonly emailService: EmailService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(usuarioId: string, dto: CreatePagamentoDto) {
    const clienteId = await this.getClienteIdOuFalhar(usuarioId);

    const inscricao = await this.prisma.inscricao.findUnique({
      where: { id: dto.inscricaoId },
      include: {
        cliente: { include: { pf: true, pj: true, usuario: true } },
        categoria: {
          include: {
            modalidade: {
              include: {
                evento: {
                  include: { organizador: true },
                },
              },
            },
          },
        },
      },
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

    // Se já existe uma tentativa de pagamento pendente para esta inscrição com este método, reaproveita
    const pagamentoExistente = await this.prisma.pagamento.findFirst({
      where: {
        inscricaoId: inscricao.id,
        metodo: dto.metodo,
        status: StatusPagamento.PENDENTE,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (pagamentoExistente && (pagamentoExistente.pixCopiaECola || pagamentoExistente.pixQrCodeUrl)) {
      return pagamentoExistente;
    }

    const valorBaseInscricao = await calcularValorInscricao(this.prisma, {
      loteId: inscricao.loteId,
      modalidadeId: inscricao.categoria.modalidadeId,
      clienteId: inscricao.clienteId,
      eventoId: inscricao.categoria.modalidade.eventoId,
      cupomId: inscricao.cupomId,
    });

    const evento = inscricao.categoria.modalidade.evento;
    const organizadorWalletId = evento.organizador?.asaasWalletId;
    const comissaoPercentual = Number(evento.organizador?.comissaoPercentual ?? 10);

    // Comissão de 10% calculada estritamente sobre o VALOR REAL do evento
    const comissaoPlataforma = valorBaseInscricao * (comissaoPercentual / 100);

    let valorCobrado = valorBaseInscricao;

    if (dto.metodo === MetodoPagamento.CARTAO_CREDITO) {
      const parcelas = Math.max(1, dto.parcelas || 1);
      const percentualJurosAsaas = parcelas * 0.0299; // 2.99% por parcela Asaas
      const taxaFixaCartao = 0.49;
      valorCobrado = Number(((valorBaseInscricao + taxaFixaCartao) * (1 + percentualJurosAsaas)).toFixed(2));
    }

    const nomeCliente =
      inscricao.cliente.pf?.nomeCompleto ||
      inscricao.cliente.pj?.razaoSocial ||
      'Atleta Esportivo';
    const cpfCnpjCliente =
      inscricao.cliente.pf?.cpf ||
      inscricao.cliente.pj?.cnpj ||
      '00000000000';
    const emailCliente = inscricao.cliente.usuario.email;

    let asaasRes: { asaasPaymentId: string; pixCopiaECola?: string | null; pixQrCodeUrl?: string | null; status?: string } = {
      asaasPaymentId: `pay_mock_${randomUUID()}`,
    };

    if (dto.metodo === MetodoPagamento.PIX) {
      asaasRes = await this.asaasService.gerarCobrancaPix({
        inscricaoId: inscricao.id,
        valor: valorCobrado,
        cliente: { nome: nomeCliente, cpfCnpj: cpfCnpjCliente, email: emailCliente },
        organizadorWalletId,
        comissaoPlataforma,
      });
    } else if (dto.metodo === MetodoPagamento.CARTAO_CREDITO) {
      asaasRes = await this.asaasService.processarPagamentoCartao({
        inscricaoId: inscricao.id,
        valorTotal: valorCobrado,
        cliente: { nome: nomeCliente, cpfCnpj: cpfCnpjCliente, email: emailCliente },
        cartao: {
          holderName: dto.cartaoHolderName || nomeCliente,
          number: dto.cartaoNumero?.replace(/\D/g, '') || '4444555566667777',
          expiryMonth: dto.cartaoMesValidade || '12',
          expiryYear: dto.cartaoAnoValidade || '2030',
          ccv: dto.cartaoCcv || '123',
          cpfTitular: dto.cpfTitular || cpfCnpjCliente,
          cep: dto.cep || (inscricao.cliente as any).endereco?.cep || '60000000',
          numeroResidencia: dto.numeroResidencia || (inscricao.cliente as any).endereco?.numero || '100',
        },
        parcelas: dto.parcelas || 1,
        organizadorWalletId,
        comissaoPlataforma,
      });
    }

    const isAprovado = asaasRes.status === 'APROVADO';

    const [pagamentoCriado] = await this.prisma.$transaction([
      this.prisma.pagamento.create({
        data: {
          inscricaoId: inscricao.id,
          valor: valorCobrado,
          metodo: dto.metodo,
          status: isAprovado ? StatusPagamento.APROVADO : StatusPagamento.PENDENTE,
          gateway: 'asaas',
          codigoTransacao: asaasRes.asaasPaymentId,
          asaasPaymentId: asaasRes.asaasPaymentId,
          pixCopiaECola: asaasRes.pixCopiaECola || null,
          pixQrCodeUrl: asaasRes.pixQrCodeUrl || null,
          dataPagamento: isAprovado ? new Date() : null,
        },
      }),
      ...(isAprovado
        ? [
            this.prisma.inscricao.update({
              where: { id: inscricao.id },
              data: { status: StatusInscricao.CONFIRMADA },
            }),
          ]
        : []),
    ]);

    this.auditLogService.log({
      categoria: CategoriaAuditLog.FINANCEIRO,
      nivel: NivelAuditLog.INFO,
      mensagem: `Cobrança ${dto.metodo} gerada no valor de R$ ${valorCobrado.toFixed(2)}`,
      detalhes: {
        pagamentoId: pagamentoCriado.id,
        inscricaoId: inscricao.id,
        metodo: dto.metodo,
        valotTotal: valorCobrado,
        comissaoPlataforma,
      },
      usuarioId,
    });

    return pagamentoCriado;
  }

  async simularAprovacao(usuarioId: string, pagamentoId: string) {
    const pagamento = await this.buscarPagamentoDoClienteOuFalhar(
      usuarioId,
      pagamentoId,
    );

    const [pagamentoAtualizado, inscricaoAtualizada] = await this.prisma.$transaction([
      this.prisma.pagamento.update({
        where: { id: pagamento.id },
        data: { status: StatusPagamento.APROVADO, dataPagamento: new Date() },
      }),
      this.prisma.inscricao.update({
        where: { id: pagamento.inscricaoId },
        data: { status: StatusInscricao.CONFIRMADA },
        include: {
          cliente: { include: { pf: true, pj: true, usuario: true } },
          categoria: {
            include: {
              modalidade: {
                include: { evento: true },
              },
            },
          },
        },
      }),
    ]);

    if (inscricaoAtualizada) {
      const nomeAtleta =
        inscricaoAtualizada.cliente.pf?.nomeCompleto ||
        inscricaoAtualizada.cliente.pj?.razaoSocial ||
        'Atleta Esportivo';
      const emailAtleta = inscricaoAtualizada.cliente.usuario.email;
      const evento = inscricaoAtualizada.categoria.modalidade.evento;

      await this.emailService.enviarConfirmacaoInscricao({
        emailAtleta,
        nomeAtleta,
        nomeEvento: evento.nome,
        dataEvento: new Date(evento.dataInicio).toLocaleDateString('pt-BR'),
        localEvento: evento.local,
        cidadeEstado: `${evento.cidade}/${evento.estado}`,
        modalidade: inscricaoAtualizada.categoria.modalidade.nome,
        categoria: inscricaoAtualizada.categoria.nome,
        tamanhoCamisa: inscricaoAtualizada.tamanhoCamisa,
        inscricaoId: inscricaoAtualizada.id,
        valorTotal: Number(pagamento.valor).toFixed(2),
      });
    }

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
