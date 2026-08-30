import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { OrganizadorModule } from '../organizador/organizador.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { NotificacaoAdminModule } from './notificacao-admin.module';

@Module({
  imports: [AdminAuthModule, OrganizadorModule, NotificacaoAdminModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [NotificacaoAdminModule],
})
export class AdminModule {}
