import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PagamentoController } from './pagamento.controller';
import { WebhookController } from './webhook.controller';
import { PagamentoService } from './pagamento.service';
import { AsaasService } from './asaas.service';
import { TarifaService } from './tarifa.service';

import { EmailModule } from '../email/email.module';
import { NotificacaoAdminModule } from '../admin/notificacao-admin.module';

@Module({
  imports: [ConfigModule, EmailModule, NotificacaoAdminModule],
  controllers: [PagamentoController, WebhookController],
  providers: [PagamentoService, AsaasService, TarifaService],
  exports: [PagamentoService, AsaasService, TarifaService],
})
export class PagamentoModule {}
