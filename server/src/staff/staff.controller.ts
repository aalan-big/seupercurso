import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { StaffJwtGuard } from '../staff-auth/guards/staff-jwt.guard';
import {
  CurrentStaff,
  type AuthenticatedStaff,
} from '../staff-auth/decorators/current-staff.decorator';
import { OrganizadorService } from '../organizador/organizador.service';

@UseGuards(StaffJwtGuard)
@Controller('staff/me')
export class StaffController {
  constructor(private readonly organizadorService: OrganizadorService) {}

  @Get('eventos')
  listarEventos(@CurrentStaff() staff: AuthenticatedStaff) {
    return this.organizadorService.listarEventosComoStaff(staff.organizadorId);
  }

  @Get('eventos/:eventoId/checkin')
  buscarParaCheckin(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Param('eventoId') eventoId: string,
    @Query('busca') busca?: string,
  ) {
    return this.organizadorService.buscarParaCheckinComoStaff(
      staff.organizadorId,
      eventoId,
      busca,
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('eventos/:eventoId/checkin/:inscricaoId')
  confirmarEntregaKit(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Param('eventoId') eventoId: string,
    @Param('inscricaoId') inscricaoId: string,
  ) {
    return this.organizadorService.confirmarEntregaKitComoStaff(
      staff.organizadorId,
      eventoId,
      inscricaoId,
    );
  }

  @Delete('eventos/:eventoId/checkin/:inscricaoId')
  desfazerEntregaKit(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Param('eventoId') eventoId: string,
    @Param('inscricaoId') inscricaoId: string,
  ) {
    return this.organizadorService.desfazerEntregaKitComoStaff(
      staff.organizadorId,
      eventoId,
      inscricaoId,
    );
  }
}
