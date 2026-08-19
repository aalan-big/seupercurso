import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { AdminJwtGuard } from '../admin-auth/guards/admin-jwt.guard';
import { CategoriaAuditLog, NivelAuditLog } from '../generated/prisma/enums';

@Controller('admin/logs')
@UseGuards(AdminJwtGuard)
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  listarLogs(
    @Query('categoria') categoria?: CategoriaAuditLog,
    @Query('nivel') nivel?: NivelAuditLog,
    @Query('busca') busca?: string,
    @Query('pagina') pagina?: number,
    @Query('limite') limite?: number,
  ) {
    return this.auditLogService.listarLogs({
      categoria,
      nivel,
      busca,
      pagina,
      limite,
    });
  }
}
