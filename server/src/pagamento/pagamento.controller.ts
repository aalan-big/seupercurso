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
  async obterTarifas(
    @Query('valorBase') valorBase?: string,
    @Query('eventoId') eventoId?: string,
    // Preco antes do cupom: a taxa do site sai dele (ver calcularValoresInscricao).
    // Sem o parametro vale o proprio valorBase, como antes.
    @Query('baseComissao') baseComissao?: string,
  ) {
    const base = Number(valorBase);
    const baseTaxa =
      baseComissao !== undefined && Number.isFinite(Number(baseComissao))
        ? Math.max(0, Number(baseComissao))
        : undefined;

    // A mesma tarifa que o `create` vai usar: sem isso a tela mostraria o
    // parcelamento com a nossa tarifa e a cobranca sairia com a do organizador.
    const percentualCartao =
      await this.tarifaService.obterPercentualCartaoDoEvento(eventoId);

    const tabela = this.tarifaService.obterTabela(percentualCartao);

    const baseValida = Number.isFinite(base) && base > 0 ? base : 0;
    if (baseValida <= 0 && !(baseTaxa && baseTaxa > 0)) return tabela;

    // A comissao entra no valor do atleta apenas quando o organizador escolheu
    // repassa-la; e o que o checkout mostra como "taxa de servico".
    const taxaServico = await this.tarifaService.calcularTaxaServico(
      baseValida,
      eventoId,
      baseTaxa,
    );
    const comTaxa = Number((baseValida + taxaServico).toFixed(2));
    if (comTaxa <= 0) return tabela;

    return {
      ...tabela,
      taxaServico,
      pixTotal: this.tarifaService.calcularValorCobrado(
        comTaxa,
        MetodoPagamento.PIX,
      ),
      pixTarifa: this.tarifaService.estimarTarifa(comTaxa, MetodoPagamento.PIX),
      parcelamento: this.tarifaService.calcularOpcoesParcelamento(
        comTaxa,
        percentualCartao,
      ),
    };
  }

  /**
   * Chave publica do Mercado Pago com que o navegador deve tokenizar o cartao.
   *
   * Varia por evento: a cobranca roda na conta do organizador e o token do
   * cartao so vale na conta que o emitiu. `publicKey` nulo significa que o
   * cartao nao esta disponivel para esse evento.
   */
  @Get('chave-publica')
  obterChavePublica(@Query('eventoId', ParseUUIDPipe) eventoId: string) {
    return this.pagamentoService.obterChavePublica(eventoId);
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
   * Reconcilia com o Mercado Pago quando o webhook atrasa ou falha.
   */
  @Get(':id/status')
  obterStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.pagamentoService.obterStatus(user.userId, id);
  }
}
