import { Module } from '@nestjs/common';
import { NotificacaoAdminService } from './notificacao-admin.service';

@Module({
  providers: [NotificacaoAdminService],
  exports: [NotificacaoAdminService],
})
export class NotificacaoAdminModule {}
