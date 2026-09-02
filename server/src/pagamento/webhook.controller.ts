import { Controller, Post, Body, Headers, Logger, HttpCode, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { StatusInscricao, StatusPagamento, StatusSolicitacaoArte } from '../generated/prisma/enums';
import { EmailService } from '../email/email.service';
import { NotificacaoAdminService } from '../admin/notificacao-admin.service';

@Controller('pagamento/webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly notificacaoAdminService: NotificacaoAdminService,
  ) {}

  @Post('asaas')
  @HttpCode(HttpStatus.OK)
  async receberWebhookAsaas(
    @Headers('asaas-access-token') tokenRecebido: string,
    @Body() body: any,
  ) {
    const webhookSecret = this.configService.get<string>('ASAAS_WEBHOOK_SECRET');

    // Validação de segurança: verifica se o token enviado pelo Asaas bate com o .env
    if (webhookSecret && tokenRecebido !== webhookSecret) {
      this.logger.warn(`Tentativa de acesso não autorizado no Webhook Asaas com token: ${tokenRecebido}`);
      throw new UnauthorizedException('Token de segurança do webhook inválido.');
    }

    const event = body.event;
    const payment = body.payment;

    this.logger.log(`Webhook Asaas recebido: Evento=${event}, PaymentId=${payment?.id}, ExternalRef=${payment?.externalReference}`);

    if (!payment) return { received: true };

    const referenciaExterna: string | undefined = payment.externalReference;
    const asaasPaymentId = payment.id;

    // 1. Cobranças de "Solicitação de Arte" (externalReference: "arte:<id>")
    if (referenciaExterna?.startsWith('arte:')) {
      if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
        const solicitacaoArteId = referenciaExterna.slice('arte:'.length);
        this.logger.log(`Aprovando Solicitação de Arte ${solicitacaoArteId} via Webhook Asaas (${asaasPaymentId})`);
        await this.prisma.solicitacaoArte.updateMany({
          where: { id: solicitacaoArteId, status: StatusSolicitacaoArte.PENDENTE_PAGAMENTO },
          data: {
            status: StatusSolicitacaoArte.PAGO,
            dataPagamento: new Date(),
            asaasPaymentId,
          },
        });
      }
      return { received: true };
    }

    // 2. Pagamentos de Inscrições / Pedidos de Eventos Esportivos
    if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
      this.logger.log(`Processando aprovação de pagamento via Webhook Asaas: PaymentId=${asaasPaymentId}, Ref=${referenciaExterna}`);

      // Buscar o pagamento registrado no banco
      const pagamentoExistente = await this.prisma.pagamento.findFirst({
        where: {
          OR: [
            { asaasPaymentId },
            ...(referenciaExterna ? [{ pedidoId: referenciaExterna }, { inscricaoId: referenciaExterna }] : []),
          ],
        },
      });

      const pedidoId = pagamentoExistente?.pedidoId || (referenciaExterna ? await this.descobrirSeEhPedido(referenciaExterna) : null);
      const inscricaoId = pagamentoExistente?.inscricaoId || (!pedidoId ? referenciaExterna : null);

      await this.prisma.$transaction(async (tx) => {
        if (pagamentoExistente) {
          await tx.pagamento.update({
            where: { id: pagamentoExistente.id },
            data: {
              status: StatusPagamento.APROVADO,
              dataPagamento: new Date(),
              asaasPaymentId,
            },
          });
        }

        if (pedidoId) {
          await tx.inscricao.updateMany({
            where: { pedidoId },
            data: { status: StatusInscricao.CONFIRMADA },
          });
        } else if (inscricaoId) {
          await tx.inscricao.updateMany({
            where: { id: inscricaoId },
            data: { status: StatusInscricao.CONFIRMADA },
          });
        }
      });

      // Buscar inscrições atualizadas com dados completos para disparo de e-mails
      const inscricoesAtualizadas = await this.prisma.inscricao.findMany({
        where: pedidoId
          ? { pedidoId }
          : { id: inscricaoId! },
        include: {
          cliente: { include: { pf: true, pj: true, usuario: true } },
          dependente: true,
          categoria: {
            include: {
              modalidade: {
                include: { evento: true },
              },
            },
          },
        },
      });

      if (inscricoesAtualizadas.length > 0) {
        const primeiraInscricao = inscricoesAtualizadas[0];
        const evento = primeiraInscricao.categoria.modalidade.evento;
        const comprador = primeiraInscricao.cliente;
        const nomeComprador = comprador.pf?.nomeCompleto || comprador.pj?.razaoSocial || comprador.usuario.email;

        const atletasVouchers = inscricoesAtualizadas.map((insc) => ({
          inscricaoId: insc.id,
          nomeAtleta: insc.dependente?.nomeCompleto || insc.atletaNome || comprador.pf?.nomeCompleto || 'Atleta Esportivo',
          cpfAtleta: insc.dependente?.cpf || insc.atletaCpf || comprador.pf?.cpf || null,
          modalidade: insc.categoria.modalidade.nome,
          categoria: insc.categoria.nome,
          tamanhoCamisa: insc.tamanhoCamisa || 'N/A',
          numeroPeito: insc.numeroPeito,
          valor: Number(payment.value || 0).toFixed(2),
        }));

        try {
          await this.emailService.enviarConfirmacaoInscricaoBatch({
            emailComprador: comprador.usuario.email,
            nomeComprador,
            nomeEvento: evento.nome,
            dataEvento: new Date(evento.dataInicio).toLocaleDateString('pt-BR'),
            localEvento: evento.local,
            cidadeEstado: `${evento.cidade}/${evento.estado}`,
            valorTotal: Number(payment.value || 0).toFixed(2),
            atletas: atletasVouchers,
          });
        } catch (mailErr) {
          this.logger.error(`Erro ao disparar e-mail de confirmação pós-webhook: ${mailErr}`);
        }

        // Dispara notificação de comissão no painel admin
        const valorTotalNum = Number(payment.value || 0);
        const comissaoPercentual = Number(evento.organizadorId ? 10 : 10);
        const comissaoPlataforma = valorTotalNum * (comissaoPercentual / 100);
        if (comissaoPlataforma > 0) {
          this.notificacaoAdminService.notificarComissao(comissaoPlataforma, valorTotalNum);
        }
      }
    } else if (event === 'PAYMENT_REFUNDED' || event === 'PAYMENT_DELETED' || event === 'PAYMENT_CHARGEBACK_REQUESTED') {
      this.logger.warn(`Pagamento Asaas ${asaasPaymentId} foi estornado/cancelado (${event})`);
      await this.prisma.pagamento.updateMany({
        where: { asaasPaymentId },
        data: { status: StatusPagamento.ESTORNADO },
      });
    }

    return { received: true };
  }

  private async descobrirSeEhPedido(refId: string): Promise<string | null> {
    try {
      const pedido = await this.prisma.pedido.findUnique({ where: { id: refId } });
      return pedido ? pedido.id : null;
    } catch {
      return null;
    }
  }
}
