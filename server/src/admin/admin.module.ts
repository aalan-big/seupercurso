import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { NotificacaoAdminService } from './notificacao-admin.service';

@Module({
  imports: [AdminAuthModule],
  controllers: [AdminController],
  providers: [AdminService, NotificacaoAdminService],
  exports: [NotificacaoAdminService],
})
export class AdminModule {}
