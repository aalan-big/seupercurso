import { createHmac, timingSafeEqual } from 'crypto';
import {
  Controller,
  Post,
  Body,
  Headers,
  Query,
  Logger,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PagamentoService } from '../pagamento.service';

/**
 * Notificações do Mercado Pago.
 *
 * Diferente do Asaas, o corpo traz só o id: o status vem de uma consulta nossa
 * à API. Isso é bom — o que confirma a inscrição é sempre a resposta do
 * gateway, nunca o conteúdo de um POST que qualquer um poderia forjar.
 */
@Controller('pagamento/webhook')
export class MercadoPagoWebhookController {
  private readonly logger = new Logger(MercadoPagoWebhookController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly pagamentoService: PagamentoService,
  ) {}

  @Post('mercadopago')
  @HttpCode(HttpStatus.OK)
  async receber(
    @Headers('x-signature') assinatura: string,
    @Headers('x-request-id') requestId: string,
    @Query('data.id') dataIdQuery: string,
    @Body() body: any,
  ) {
    const pagamentoId = String(body?.data?.id ?? dataIdQuery ?? '');
    const tipo = body?.type ?? body?.topic;

    this.validarAssinatura(assinatura, requestId, pagamentoId);

    this.logger.log(
      `Webhook Mercado Pago: tipo=${tipo}, action=${body?.action}, paymentId=${pagamentoId}`,
    );

    if (tipo !== 'payment' || !pagamentoId) {
      return { received: true };
    }

    await this.pagamentoService.sincronizarComGateway(pagamentoId, 'webhook');

    return { received: true };
  }

  /**
   * Assinatura HMAC do Mercado Pago. Falha fechada: sem o segredo configurado o
   * endpoint ficaria aberto para qualquer um disparar sincronizações.
   */
  private validarAssinatura(
    assinatura: string | undefined,
    requestId: string | undefined,
    pagamentoId: string,
  ) {
    const segredo = this.configService.get<string>('MP_WEBHOOK_SECRET');

    if (!segredo) {
      this.logger.error(
        'MP_WEBHOOK_SECRET não configurada — webhook do Mercado Pago recusado por segurança.',
      );
      throw new UnauthorizedException('Webhook não configurado.');
    }

    const partes = Object.fromEntries(
      (assinatura ?? '')
        .split(',')
        .map((p) => p.split('=').map((t) => t.trim()))
        .filter((p) => p.length === 2),
    );

    const ts = partes['ts'];
    const v1 = partes['v1'];

    if (!ts || !v1) {
      this.logger.warn('Webhook Mercado Pago sem assinatura válida.');
      throw new UnauthorizedException('Assinatura ausente.');
    }

    const manifesto = `id:${pagamentoId};request-id:${requestId ?? ''};ts:${ts};`;
    const esperado = createHmac('sha256', segredo)
      .update(manifesto)
      .digest('hex');

    const a = Buffer.from(esperado);
    const b = Buffer.from(v1);

    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      this.logger.warn('Assinatura do webhook Mercado Pago inválida.');
      throw new UnauthorizedException('Assinatura inválida.');
    }
  }
}
