import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PagamentoController } from './pagamento.controller';
import { PagamentoService } from './pagamento.service';
import { TarifaService } from './tarifa.service';
import { GATEWAY_PAGAMENTO } from './gateway.port';
import { MercadoPagoService } from './mercadopago/mercadopago.service';
import { MercadoPagoOAuthService } from './mercadopago/mercadopago-oauth.service';
import { MercadoPagoWebhookController } from './mercadopago/mercadopago-webhook.controller';

import { EmailModule } from '../email/email.module';
import { NotificacaoAdminModule } from '../admin/notificacao-admin.module';

@Module({
  imports: [ConfigModule, EmailModule, NotificacaoAdminModule],
  controllers: [PagamentoController, MercadoPagoWebhookController],
  providers: [
    PagamentoService,
    TarifaService,
    MercadoPagoService,
    MercadoPagoOAuthService,
    // Trocar de gateway é apontar este provider para outro adaptador.
    { provide: GATEWAY_PAGAMENTO, useExisting: MercadoPagoService },
  ],
  exports: [
    PagamentoService,
    TarifaService,
    MercadoPagoOAuthService,
    GATEWAY_PAGAMENTO,
  ],
})
export class PagamentoModule {}
