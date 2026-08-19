import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PagamentoController } from './pagamento.controller';
import { WebhookController } from './webhook.controller';
import { PagamentoService } from './pagamento.service';
import { AsaasService } from './asaas.service';

import { EmailModule } from '../email/email.module';

@Module({
  imports: [ConfigModule, EmailModule],
  controllers: [PagamentoController, WebhookController],
  providers: [PagamentoService, AsaasService],
  exports: [PagamentoService, AsaasService],
})
export class PagamentoModule {}
