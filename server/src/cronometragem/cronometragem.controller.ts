import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../auth/decorators/current-user.decorator';
import { CronometragemService } from './cronometragem.service';
import { WebhookResultadoDto } from './dto/webhook-resultado.dto';
import { ImportarCsvResultadoDto } from './dto/importar-csv-resultado.dto';

@Controller()
export class CronometragemController {
  constructor(private readonly cronometragemService: CronometragemService) {}

  // --- ROTA PÚBLICA / WEBHOOK PARA A EMPRESA DE CRONOMETRAGEM ---
  @HttpCode(HttpStatus.OK)
  @Post('cronometragem/webhooks/resultados')
  processarWebhook(
    @Headers('authorization') authHeader: string,
    @Body() dto: WebhookResultadoDto,
  ) {
    const apiKey = authHeader ? authHeader.replace(/^Bearer\s+/i, '') : '';
    return this.cronometragemService.processarResultadoWebhook(apiKey, dto);
  }

  // --- ROTAS DO PAINEL DO ORGANIZADOR ---
  @UseGuards(JwtAuthGuard)
  @Get('eventos/:id/cronometragem/info')
  buscarInfo(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') eventoId: string,
  ) {
    return this.cronometragemService.buscarInfoCronometragem(
      user.userId,
      eventoId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('eventos/:id/cronometragem/api-key')
  gerarApiKey(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') eventoId: string,
  ) {
    return this.cronometragemService.gerarOuRenovarApiKey(
      user.userId,
      eventoId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('eventos/:id/cronometragem/importar-csv')
  importarCsv(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') eventoId: string,
    @Body() dto: ImportarCsvResultadoDto,
  ) {
    return this.cronometragemService.importarResultadosLote(
      user.userId,
      eventoId,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('eventos/:id/cronometragem/resultados')
  listarResultados(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') eventoId: string,
  ) {
    return this.cronometragemService.listarResultadosEvento(
      user.userId,
      eventoId,
    );
  }
}
