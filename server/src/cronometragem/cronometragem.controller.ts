import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../auth/decorators/current-user.decorator';
import { AssinaturaAtivaGuard } from './guards/assinatura-ativa.guard';
import { CronometragemService } from './cronometragem.service';
import { WebhookResultadoDto } from './dto/webhook-resultado.dto';
import { ImportarCsvResultadoDto } from './dto/importar-csv-resultado.dto';
import { CriarSolicitacaoDto } from './dto/criar-solicitacao.dto';
import { ItemPassagemDto } from './dto/enviar-passagem.dto';
import { EnviarChipsDto, ImportarChipsDto } from './dto/importar-chips.dto';

@Controller()
export class CronometragemController {
  constructor(private readonly cronometragemService: CronometragemService) {}

  // =========================================================================
  // ROTAS DO PROGRAMA DESKTOP (SEUPERCURSO MARK)
  // Exigem token JWT + Assinatura Ativa da Cronometradora
  // =========================================================================

  @UseGuards(JwtAuthGuard, AssinaturaAtivaGuard)
  @Get('cronometragem/conta')
  obterConta(@CurrentUser() user: AuthenticatedUser) {
    return this.cronometragemService.getConta(user.userId);
  }

  @UseGuards(JwtAuthGuard, AssinaturaAtivaGuard)
  @Get('cronometragem/provas/busca')
  buscarProvas(@Query('nome') nome: string) {
    return this.cronometragemService.buscarProvas(nome);
  }

  @UseGuards(JwtAuthGuard, AssinaturaAtivaGuard)
  @HttpCode(HttpStatus.CREATED)
  @Post('cronometragem/solicitacoes')
  criarSolicitacao(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
    @Body() dto: CriarSolicitacaoDto,
  ) {
    return this.cronometragemService.criarSolicitacao(
      user.userId,
      req.cronometradora.id,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard, AssinaturaAtivaGuard)
  @Get('cronometragem/solicitacoes')
  listarSolicitacoes(@Req() req: any) {
    return this.cronometragemService.listarSolicitacoes(req.cronometradora.id);
  }

  @UseGuards(JwtAuthGuard, AssinaturaAtivaGuard)
  @Get('cronometragem/provas')
  listarProvasLiberadas(@Req() req: any) {
    return this.cronometragemService.listarProvasLiberadas(req.cronometradora.id);
  }

  @UseGuards(JwtAuthGuard, AssinaturaAtivaGuard)
  @Get('cronometragem/provas/:id/inscritos')
  baixarInscritos(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
    @Param('id') eventoId: string,
  ) {
    return this.cronometragemService.baixarInscritos(
      user.userId,
      req.cronometradora.id,
      eventoId,
    );
  }

  @UseGuards(JwtAuthGuard, AssinaturaAtivaGuard)
  @HttpCode(HttpStatus.OK)
  @Post('cronometragem/provas/:id/chips')
  enviarChips(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
    @Param('id') eventoId: string,
    @Body() dto: EnviarChipsDto,
  ) {
    return this.cronometragemService.enviarChips(
      user.userId,
      req.cronometradora.id,
      eventoId,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard, AssinaturaAtivaGuard)
  @HttpCode(HttpStatus.OK)
  @Post('cronometragem/passagens')
  receberPassagens(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
    @Body() itens: ItemPassagemDto[],
  ) {
    return this.cronometragemService.receberPassagens(
      user.userId,
      req.cronometradora.id,
      itens,
    );
  }

  // =========================================================================
  // GESTÃO DO ORGANIZADOR DA PROVA (Aprovar / Recusar solicitações)
  // =========================================================================

  @UseGuards(JwtAuthGuard)
  @Get('eventos/:id/cronometragem/solicitacoes')
  listarSolicitacoesDoEvento(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') eventoId: string,
  ) {
    return this.cronometragemService.listarSolicitacoesDoEvento(
      user.userId,
      eventoId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('cronometragem/solicitacoes/:id/aprovar')
  aprovarSolicitacao(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') solicitacaoId: string,
  ) {
    return this.cronometragemService.aprovarSolicitacao(
      user.userId,
      solicitacaoId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('cronometragem/solicitacoes/:id/recusar')
  recusarSolicitacao(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') solicitacaoId: string,
    @Body('resposta') resposta?: string,
  ) {
    return this.cronometragemService.recusarSolicitacao(
      user.userId,
      solicitacaoId,
      resposta,
    );
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('cronometragem/solicitacoes/:id/revogar')
  revogarSolicitacao(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') solicitacaoId: string,
  ) {
    return this.cronometragemService.revogarSolicitacao(
      user.userId,
      solicitacaoId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('eventos/:id/cronometragem/chips/importar')
  importarChips(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') eventoId: string,
    @Body() dto: ImportarChipsDto,
  ) {
    return this.cronometragemService.importarChips(user.userId, eventoId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('eventos/:id/cronometragem/chips')
  obterResumoChips(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') eventoId: string,
  ) {
    return this.cronometragemService.obterResumoChips(user.userId, eventoId);
  }

  // =========================================================================
  // ROTAS EXISTENTES DE WEBHOOK / RESULTADOS
  // =========================================================================

  @HttpCode(HttpStatus.OK)
  @Post('cronometragem/webhooks/resultados')
  processarWebhook(
    @Headers('authorization') authHeader: string,
    @Body() dto: WebhookResultadoDto,
  ) {
    const apiKey = authHeader ? authHeader.replace(/^Bearer\s+/i, '') : '';
    return this.cronometragemService.processarResultadoWebhook(apiKey, dto);
  }

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
