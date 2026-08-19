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

    const valor = await calcularValorInscricao(this.prisma, {
      loteId: inscricao.loteId,
      modalidadeId: inscricao.categoria.modalidadeId,
      clienteId: inscricao.clienteId,
      eventoId: inscricao.categoria.modalidade.eventoId,
      cupomId: inscricao.cupomId,
    });

    const evento = inscricao.categoria.modalidade.evento;
    const organizadorWalletId = evento.organizador?.asaasWalletId;
    const comissaoPercentual = Number(evento.organizador?.comissaoPercentual ?? 10);
    const comissaoPlataforma = valor * (comissaoPercentual / 100);

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

    if (dto.metodo === 'PIX') {
      asaasRes = await this.asaasService.gerarCobrancaPix({
        inscricaoId: inscricao.id,
        valor,
        cliente: { nome: nomeCliente, cpfCnpj: cpfCnpjCliente, email: emailCliente },
        organizadorWalletId,
        comissaoPlataforma,
      });
    }

    const pagamentoCriado = await this.prisma.pagamento.create({
      data: {
        inscricaoId: inscricao.id,
        valor,
        metodo: dto.metodo,
        status: asaasRes.status === 'APROVADO' ? StatusPagamento.APROVADO : StatusPagamento.PENDENTE,
        gateway: 'asaas',
        codigoTransacao: asaasRes.asaasPaymentId,
        asaasPaymentId: asaasRes.asaasPaymentId,
        pixCopiaECola: asaasRes.pixCopiaECola || null,
        pixQrCodeUrl: asaasRes.pixQrCodeUrl || null,
      },
    });

    this.auditLogService.log({
      categoria: CategoriaAuditLog.FINANCEIRO,
      nivel: NivelAuditLog.INFO,
      mensagem: `Cobrança ${dto.metodo} gerada no valor de R$ ${valor.toFixed(2)}`,
      detalhes: {
        pagamentoId: pagamentoCriado.id,
        inscricaoId: inscricao.id,
        metodo: dto.metodo,
        valotTotal: valor,
        comissaoPlataforma: valor * (comissaoPercentual / 100),
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
