import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../auth/decorators/current-user.decorator';
import { PagamentoService } from './pagamento.service';
import { CreatePagamentoDto } from './dto/create-pagamento.dto';
import { TarifaService } from './tarifa.service';
import { MetodoPagamento } from '../generated/prisma/enums';

@UseGuards(JwtAuthGuard)
@Controller('pagamentos')
export class PagamentoController {
  constructor(
    private readonly pagamentoService: PagamentoService,
    private readonly tarifaService: TarifaService,
  ) {}

  /**
   * Tarifas do gateway e opcoes de parcelamento ja com a tarifa embutida.
   *
   * Existe para o front nao repetir a formula: ela estava escrita em tres
   * lugares e qualquer mudanca de tarifa exigia lembrar de todos.
   */
  @Get('tarifas')
  obterTarifas(@Query('valorBase') valorBase?: string) {
    const base = Number(valorBase);
    const tabela = this.tarifaService.obterTabela();

    return {
      ...tabela,
      ...(Number.isFinite(base) && base > 0
        ? {
            pixTotal: this.tarifaService.calcularValorCobrado(
              base,
              MetodoPagamento.PIX,
            ),
            pixTarifa: this.tarifaService.estimarTarifa(base, MetodoPagamento.PIX),
            parcelamento: this.tarifaService.calcularOpcoesParcelamento(base),
          }
        : {}),
    };
  }

  @HttpCode(HttpStatus.CREATED)
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePagamentoDto,
    @Ip() ip: string,
  ) {
    return this.pagamentoService.create(user.userId, dto, ip);
  }

  /**
   * Acompanhamento da cobrança pelo comprador (usado no polling da tela de PIX).
   * Reconcilia com o Asaas quando o webhook atrasa ou falha.
   */
  @Get(':id/status')
  obterStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.pagamentoService.obterStatus(user.userId, id);
  }
}
