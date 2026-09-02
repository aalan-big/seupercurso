import { timingSafeEqual } from 'crypto';
import {
  Controller,
  Post,
  Body,
  Headers,
  Logger,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { StatusSolicitacaoArte } from '../generated/prisma/enums';
import { PagamentoService } from './pagamento.service';

const EVENTOS_APROVACAO = ['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'];
const EVENTOS_ESTORNO = [
  'PAYMENT_REFUNDED',
  'PAYMENT_DELETED',
  'PAYMENT_CHARGEBACK_REQUESTED',
];

@Controller('pagamento/webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly pagamentoService: PagamentoService,
  ) {}

  @Post('asaas')
  @HttpCode(HttpStatus.OK)
  async receberWebhookAsaas(
    @Headers('asaas-access-token') tokenRecebido: string,
    @Body() body: any,
  ) {
    this.validarToken(tokenRecebido);

    const event = body?.event;
    const payment = body?.payment;

    this.logger.log(
      `Webhook Asaas recebido: Evento=${event}, PaymentId=${payment?.id}, ExternalRef=${payment?.externalReference}`,
    );

    if (!payment?.id) return { received: true };

    const referenciaExterna: string | undefined = payment.externalReference;
    const asaasPaymentId: string = payment.id;

    // 1. Cobranças de "Solicitação de Arte" (externalReference: "arte:<id>")
    if (referenciaExterna?.startsWith('arte:')) {
      if (EVENTOS_APROVACAO.includes(event)) {
        const solicitacaoArteId = referenciaExterna.slice('arte:'.length);
        this.logger.log(
          `Aprovando Solicitação de Arte ${solicitacaoArteId} via Webhook Asaas (${asaasPaymentId})`,
        );
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
    if (EVENTOS_APROVACAO.includes(event)) {
      await this.pagamentoService.confirmarPagamento({
        asaasPaymentId,
        referenciaExterna,
        valorPago: Number(payment.value ?? 0),
        origem: 'webhook',
      });
    } else if (EVENTOS_ESTORNO.includes(event)) {
      this.logger.warn(
        `Pagamento Asaas ${asaasPaymentId} foi estornado/cancelado (${event})`,
      );
      await this.pagamentoService.registrarEstorno(asaasPaymentId);
    }

    return { received: true };
  }

  /**
   * Falha fechada: sem o segredo configurado o endpoint ficaria aberto para
   * qualquer um confirmar inscrições, então recusamos em vez de liberar.
   */
  private validarToken(tokenRecebido?: string) {
    const webhookSecret = this.configService.get<string>('ASAAS_WEBHOOK_SECRET');

    if (!webhookSecret) {
      this.logger.error(
        'ASAAS_WEBHOOK_SECRET não configurada — webhook do Asaas recusado por segurança.',
      );
      throw new UnauthorizedException('Webhook não configurado.');
    }

    const esperado = Buffer.from(webhookSecret);
    const recebido = Buffer.from(tokenRecebido ?? '');

    // Comparação em tempo constante evita vazar o segredo por timing.
    const valido =
      esperado.length === recebido.length && timingSafeEqual(esperado, recebido);

    if (!valido) {
      this.logger.warn('Tentativa de acesso não autorizado no Webhook Asaas.');
      throw new UnauthorizedException('Token de segurança do webhook inválido.');
    }
  }
}
