import { createHmac } from 'crypto';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { MercadoPagoWebhookController } from './mercadopago-webhook.controller';

const SEGREDO = 'segredo-de-teste';

function assinar(pagamentoId: string, requestId: string, ts = '1700000000') {
  const v1 = createHmac('sha256', SEGREDO)
    .update(`id:${pagamentoId};request-id:${requestId};ts:${ts};`)
    .digest('hex');
  return `ts=${ts},v1=${v1}`;
}

describe('MercadoPagoWebhookController', () => {
  let controller: MercadoPagoWebhookController;
  let pagamentoService: { sincronizarComGateway: jest.Mock };
  let avisos: jest.SpyInstance;

  beforeEach(() => {
    pagamentoService = { sincronizarComGateway: jest.fn().mockResolvedValue(undefined) };
    const configService = { get: jest.fn().mockReturnValue(SEGREDO) };
    controller = new MercadoPagoWebhookController(configService as any, pagamentoService as any);
    avisos = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('assinatura certa: sincroniza o pagamento com o gateway', async () => {
    const body = { type: 'payment', action: 'payment.updated', data: { id: '123' } };

    const res = await controller.receber(assinar('123', 'req-1'), 'req-1', undefined as any, body);

    expect(res).toEqual({ received: true });
    expect(pagamentoService.sincronizarComGateway).toHaveBeenCalledWith('123', 'webhook');
  });

  it('assinatura errada: recusa, nao sincroniza e diz no log qual aviso era', async () => {
    const body = { type: 'payment', action: 'payment.updated', data: { id: '123' } };

    await expect(
      controller.receber(assinar('999', 'req-1'), 'req-1', undefined as any, body),
    ).rejects.toThrow(UnauthorizedException);

    expect(pagamentoService.sincronizarComGateway).not.toHaveBeenCalled();
    expect(avisos).toHaveBeenCalledWith(
      'Assinatura do webhook Mercado Pago inválida (tipo=payment, action=payment.updated, paymentId=123).',
    );
  });

  it('sem assinatura: recusa e mostra o tipo do aviso (ex.: merchant_order)', async () => {
    const body = { topic: 'merchant_order' };

    await expect(
      controller.receber(undefined as any, undefined as any, '456', body),
    ).rejects.toThrow(UnauthorizedException);

    expect(pagamentoService.sincronizarComGateway).not.toHaveBeenCalled();
    expect(avisos).toHaveBeenCalledWith(
      'Webhook Mercado Pago sem assinatura válida (tipo=merchant_order, action=undefined, paymentId=456).',
    );
  });
});
