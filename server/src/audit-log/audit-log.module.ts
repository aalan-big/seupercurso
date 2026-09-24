import { Global, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AuditLogService } from './audit-log.service';
import { AuditLogController } from './audit-log.controller';
import { RegistrarErrosFilter } from './registrar-erros.filter';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [AuditLogController],
  providers: [
    AuditLogService,
    // Filtro global: erros 5xx de qualquer rota vao para a tela de Logs.
    { provide: APP_FILTER, useClass: RegistrarErrosFilter },
  ],
  exports: [AuditLogService],
})
export class AuditLogModule {}
