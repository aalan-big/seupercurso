import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminJwtGuard } from '../admin-auth/guards/admin-jwt.guard';
import { AdminCronometragemService } from './admin-cronometragem.service';
import {
  CriarCronometradoraDto,
  RenovarAssinaturaDto,
  AlterarStatusCronometradoraDto,
  VincularUsuarioCronometradoraDto,
  AtualizarUsuarioCronometradoraDto,
  AlterarLimiteNotebooksDto,
} from './dto/admin-cronometragem.dto';

@UseGuards(AdminJwtGuard)
@Controller('admin/cronometragem')
export class AdminCronometragemController {
  constructor(
    private readonly adminCronometragemService: AdminCronometragemService,
  ) {}

  @Get('empresas')
  listarCronometradoras() {
    return this.adminCronometragemService.listarCronometradoras();
  }

  @HttpCode(HttpStatus.CREATED)
  @Post('empresas')
  criarCronometradora(@Body() dto: CriarCronometradoraDto) {
    return this.adminCronometragemService.criarCronometradora(dto);
  }

  @Patch('empresas/:id/assinatura')
  renovarAssinatura(
    @Param('id') id: string,
    @Body() dto: RenovarAssinaturaDto,
  ) {
    return this.adminCronometragemService.renovarAssinatura(id, dto);
  }

  @Patch('empresas/:id/status')
  alterarStatus(
    @Param('id') id: string,
    @Body() dto: AlterarStatusCronometradoraDto,
  ) {
    return this.adminCronometragemService.alterarStatus(id, dto.status);
  }

  @Patch('empresas/:id/limite-notebooks')
  alterarLimiteNotebooks(
    @Param('id') id: string,
    @Body() dto: AlterarLimiteNotebooksDto,
  ) {
    return this.adminCronometragemService.alterarLimiteNotebooks(id, dto);
  }

  @Patch('notebooks/:notebookId/liberar')
  liberarNotebook(@Param('notebookId') notebookId: string) {
    return this.adminCronometragemService.liberarNotebook(notebookId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('empresas/:id/usuarios')
  vincularUsuario(
    @Param('id') id: string,
    @Body() dto: VincularUsuarioCronometradoraDto,
  ) {
    return this.adminCronometragemService.vincularUsuario(id, dto);
  }

  @Patch('usuarios/:usuarioId')
  atualizarUsuario(
    @Param('usuarioId') usuarioId: string,
    @Body() dto: AtualizarUsuarioCronometradoraDto,
  ) {
    return this.adminCronometragemService.atualizarUsuarioVinculo(usuarioId, dto);
  }

  @Get('solicitacoes')
  listarSolicitacoes() {
    return this.adminCronometragemService.listarSolicitacoes();
  }

  @Get('auditoria')
  listarAuditoria() {
    return this.adminCronometragemService.listarAuditoria();
  }
}
