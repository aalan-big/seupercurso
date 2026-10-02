import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { NotificacaoAdminModule } from '../admin/notificacao-admin.module';
import { CotacaoCronometragemService } from './cotacao-cronometragem.service';
import { CotacaoCronometragemController } from './cotacao-cronometragem.controller';
import { CotacaoCronometragemAdminController } from './cotacao-cronometragem-admin.controller';

@Module({
  imports: [EmailModule, NotificacaoAdminModule],
  controllers: [CotacaoCronometragemController, CotacaoCronometragemAdminController],
  providers: [CotacaoCronometragemService],
})
export class CotacaoCronometragemModule {}
