import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminJwtGuard } from '../admin-auth/guards/admin-jwt.guard';
import { CotacaoCronometragemService } from './cotacao-cronometragem.service';
import { PropostaCotacaoDto } from './dto/proposta-cotacao.dto';
import { ConfirmarPagamentoCotacaoDto } from './dto/confirmar-pagamento-cotacao.dto';
import { DadosPagamentoCronometragemDto } from './dto/dados-pagamento.dto';
import { MotivoCotacaoDto } from './dto/motivo-cotacao.dto';

@UseGuards(AdminJwtGuard)
@Controller('admin')
export class CotacaoCronometragemAdminController {
  constructor(private readonly service: CotacaoCronometragemService) {}

  @Get('configuracoes/pagamento-cronometragem')
  async obterDadosPagamento() {
    return { dados: await this.service.obterDadosPagamento() };
  }

  @Put('configuracoes/pagamento-cronometragem')
  salvarDadosPagamento(@Body() dto: DadosPagamentoCronometragemDto) {
    return this.service.salvarDadosPagamento(dto.dados);
  }

  @Get('cotacoes-cronometragem')
  listar(@Query('status') status?: string) {
    return this.service.listarTodas(status);
  }

  @Get('cotacoes-cronometragem/:id')
  buscar(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.buscarAdmin(id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('cotacoes-cronometragem/:id/proposta')
  enviarProposta(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PropostaCotacaoDto,
  ) {
    return this.service.enviarProposta(id, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('cotacoes-cronometragem/:id/confirmar-pagamento')
  confirmarPagamento(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmarPagamentoCotacaoDto,
  ) {
    return this.service.confirmarPagamento(id, dto.cronometradoraId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('cotacoes-cronometragem/:id/concluir')
  concluir(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.concluir(id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('cotacoes-cronometragem/:id/cancelar')
  cancelar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: MotivoCotacaoDto) {
    return this.service.cancelarPelaEquipe(id, dto.motivo);
  }
}
