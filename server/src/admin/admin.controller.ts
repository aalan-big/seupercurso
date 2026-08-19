import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminJwtGuard } from '../admin-auth/guards/admin-jwt.guard';
import { AdminService } from './admin.service';
import { MotivoDto } from './dto/motivo.dto';

@UseGuards(AdminJwtGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  obterDashboard() {
    return this.adminService.obterDashboard();
  }

  @Get('financeiro')
  obterFinanceiro() {
    return this.adminService.obterFinanceiro();
  }

  @Get('organizadores')
  listarOrganizadores(@Query('status') status?: string) {
    return this.adminService.listarOrganizadores(status);
  }

  @Get('organizadores/:id')
  buscarOrganizador(@Param('id') id: string) {
    return this.adminService.buscarOrganizador(id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('organizadores/:id/aprovar')
  aprovarOrganizador(@Param('id') id: string) {
    return this.adminService.aprovarOrganizador(id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('organizadores/:id/rejeitar')
  rejeitarOrganizador(@Param('id') id: string, @Body() dto: MotivoDto) {
    return this.adminService.rejeitarOrganizador(id, dto.motivo);
  }

  @HttpCode(HttpStatus.OK)
  @Post('organizadores/:id/suspender')
  suspenderOrganizador(@Param('id') id: string, @Body() dto: MotivoDto) {
    return this.adminService.suspenderOrganizador(id, dto.motivo);
  }

  @Get('eventos')
  listarEventos(@Query('status') status?: string) {
    return this.adminService.listarEventos(status);
  }

  @Get('eventos/:id')
  buscarEvento(@Param('id') id: string) {
    return this.adminService.buscarEvento(id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('eventos/:id/aprovar')
  aprovarEvento(@Param('id') id: string) {
    return this.adminService.aprovarEvento(id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('eventos/:id/rejeitar')
  rejeitarEvento(@Param('id') id: string, @Body() dto: MotivoDto) {
    return this.adminService.rejeitarEvento(id, dto.motivo);
  }

  @HttpCode(HttpStatus.OK)
  @Post('eventos/:id/suspender')
  suspenderEvento(@Param('id') id: string, @Body() dto: MotivoDto) {
    return this.adminService.suspenderEvento(id, dto.motivo);
  }
}
