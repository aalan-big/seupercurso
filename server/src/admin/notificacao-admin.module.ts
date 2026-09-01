import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificacaoAdminService } from './notificacao-admin.service';

@Module({
  imports: [ConfigModule],
  providers: [NotificacaoAdminService],
  exports: [NotificacaoAdminService],
})
export class NotificacaoAdminModule {}
