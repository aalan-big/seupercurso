import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MetodoPagamento } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';

/** Tarifa cobrada pelo gateway: um percentual sobre a transação mais um valor fixo. */
export interface TarifaGateway {
  percentual: number;
  fixo: number;
}

export interface TabelaTarifas {
  pix: TarifaGateway;
  cartao: TarifaGateway;
  /**
   * Acréscimo percentual por parcela além da taxa base do cartão.
   *
   * O Asaas cobrava por parcela; o Mercado Pago cobra uma taxa única e trata
   * parcelamento à parte. Fica configurável para o modelo não ficar preso ao
   * gateway da vez.
   */
  cartaoPercentualPorParcela: number;
  maxParcelas: number;
  valorMinimoParcela: number;
}

/**
 * Quem paga a comissao em cada cobranca.
 *
 * Repassando ao atleta (`comissaoPagaPeloAtleta`), ela vira taxa de servico
 * somada ao valor. Absorvendo, sai do repasse do organizador, mas so ate o que
 * ele tem a receber: com cupom, a comissao sai do preco antes do desconto e
 * pode passar do valor pago (cupom de 100% = valor zero). O que faltar o atleta
 * paga como taxa de servico, senao a inscricao entrava sem a parte do site.
 */
export function dividirComissao(
  valorBase: number,
  comissao: number,
  comissaoPagaPeloAtleta: boolean,
): { taxaServico: number; valorAntesDaTarifa: number; repasseOrganizador: number } {
  const taxaServico = comissaoPagaPeloAtleta
    ? comissao
    : Math.max(0, Number((comissao - valorBase).toFixed(2)));
  // Sem taxa de servico o valor segue exatamente o de antes (sem arredondar).
  const valorAntesDaTarifa =
    taxaServico > 0 ? Number((valorBase + taxaServico).toFixed(2)) : valorBase;
  return {
    taxaServico,
    valorAntesDaTarifa,
    repasseOrganizador: Math.max(0, Number((valorAntesDaTarifa - comissao).toFixed(2))),
  };
}

/**
 * Centraliza as tarifas do gateway e o repasse delas ao pagador.
 *
 * Regra do negócio: a tarifa do gateway é sempre paga por quem compra. O
 * organizador recebe o valor da inscrição menos a comissão da plataforma, e a
 * plataforma recebe a comissão cheia — nenhum dos dois absorve tarifa.
 *
 * Antes disso a fórmula estava escrita em três lugares (serviço e dois
 * formulários), e o PIX não repassava nada: a tarifa saía do repasse do
 * organizador sem que nada na tela dissesse isso.
 */
@Injectable()
export class TarifaService {
  private readonly logger = new Logger(TarifaService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Taxa de servico mostrada ao atleta: o que ele paga alem do valor das
   * inscricoes, antes da tarifa do gateway. Mesma regra de `dividirComissao`,
   * que e a que a cobranca usa.
   *
   * @param baseComissao base da taxa (ver `calcularValoresInscricao`);
   *   sem ela, vale o proprio `valorBase`, como antes.
   */
  async calcularTaxaServico(
    valorBase: number,
    eventoId?: string,
    baseComissao?: number,
  ): Promise<number> {
    const base = Math.max(0, valorBase || 0);
    const baseTaxa = Math.max(0, baseComissao ?? base);
    if (!eventoId || (base <= 0 && baseTaxa <= 0)) return 0;

    const evento = await this.prisma.evento.findUnique({
      where: { id: eventoId },
      select: {
        comissaoPagaPeloAtleta: true,
        organizador: { select: { comissaoPercentual: true } },
      },
    });
    if (!evento) return 0;

    const percentual = Number(evento.organizador?.comissaoPercentual ?? 10);
    const comissao = Number((baseTaxa * (percentual / 100)).toFixed(2));

    return dividirComissao(base, comissao, evento.comissaoPagaPeloAtleta).taxaServico;
  }

  /**
   * Tarifa de cartao da conta que vai receber este evento.
   *
   * Cada organizador recebe na conta dele, e a tarifa do Mercado Pago varia com
   * o prazo de liberacao que ele escolheu. Devolve undefined enquanto ele nao
   * tiver a primeira venda a vista — ate la vale a global.
   */
  async obterPercentualCartaoDoEvento(
    eventoId?: string,
  ): Promise<number | undefined> {
    if (!eventoId) return undefined;

    const evento = await this.prisma.evento.findUnique({
      where: { id: eventoId },
      select: { organizador: { select: { tarifaCartaoPercentual: true } } },
    });

    const aprendida = evento?.organizador?.tarifaCartaoPercentual;
    return aprendida === null || aprendida === undefined
      ? undefined
      : Number(aprendida);
  }

  obterTabela(percentualCartao?: number): TabelaTarifas {
    return {
      pix: {
        percentual: this.numero('TARIFA_PIX_PERCENTUAL', 0.0099),
        fixo: this.numero('TARIFA_PIX_FIXA', 0),
      },
      cartao: {
        // A taxa do Mercado Pago depende do prazo de liberacao da conta que
        // recebe: ~4,98% na hora, ~4,49% em 14 dias, ~3,98% em 30 dias. O
        // padrao era 3,98% enquanto a conta recebia na hora, e o gross-up
        // cobrava menos do que o gateway descontava — a diferenca saia do
        // repasse de quem vendeu, nunca da comissao da plataforma.
        //
        // Errar para cima e menos grave que para baixo: o organizador recebe
        // alguns centavos a mais em vez de receber menos do que foi prometido.
        percentual:
          percentualCartao ?? this.numero('TARIFA_CARTAO_PERCENTUAL', 0.0498),
        fixo: this.numero('TARIFA_CARTAO_FIXA', 0),
      },
      cartaoPercentualPorParcela: this.numero(
        'TARIFA_CARTAO_PERCENTUAL_PARCELA',
        0,
      ),
      maxParcelas: this.numero('MAX_PARCELAS', 5),
      valorMinimoParcela: this.numero('VALOR_MINIMO_PARCELA', 15),
    };
  }

  /**
   * Valor a cobrar do pagador para que, depois da tarifa, sobre exatamente o
   * valor da inscrição.
   *
   * É um gross-up, não um acréscimo: somar a tarifa ao preço não basta, porque
   * o percentual do gateway incide sobre o total já acrescido.
   *
   *   cobrado = (base + fixo) / (1 - percentual)
   */
  calcularValorCobrado(
    valorBase: number,
    metodo: MetodoPagamento,
    parcelas = 1,
    percentualCartao?: number,
  ): number {
    const tarifa = this.tarifaDe(metodo, parcelas, percentualCartao);

    if (tarifa.percentual >= 1) {
      this.logger.error(
        `Tarifa percentual de ${(tarifa.percentual * 100).toFixed(2)}% torna a cobrança impossível. Verifique TARIFA_CARTAO_PERCENTUAL e MAX_PARCELAS.`,
      );
      return Number(valorBase.toFixed(2));
    }

    const cobrado = (valorBase + tarifa.fixo) / (1 - tarifa.percentual);
    return Number(cobrado.toFixed(2));
  }

  /** Quanto do valor cobrado é tarifa — o acréscimo pago pelo atleta. */
  estimarTarifa(
    valorBase: number,
    metodo: MetodoPagamento,
    parcelas = 1,
    percentualCartao?: number,
  ): number {
    return Number(
      (
        this.calcularValorCobrado(valorBase, metodo, parcelas, percentualCartao) -
        valorBase
      ).toFixed(2),
    );
  }

  /** Opções de parcelamento com o valor já acrescido da tarifa. */
  calcularOpcoesParcelamento(valorBase: number, percentualCartao?: number) {
    const { maxParcelas, valorMinimoParcela } = this.obterTabela(percentualCartao);
    if (!valorBase || valorBase <= 0) return [];

    const teto = Math.min(
      maxParcelas,
      Math.max(1, Math.floor(valorBase / valorMinimoParcela)) || 1,
    );

    return Array.from({ length: teto }, (_, i) => {
      const num = i + 1;
      const total = this.calcularValorCobrado(
        valorBase,
        MetodoPagamento.CARTAO_CREDITO,
        num,
        percentualCartao,
      );
      return {
        num,
        total,
        parcela: Number((total / num).toFixed(2)),
      };
    });
  }

  private tarifaDe(
    metodo: MetodoPagamento,
    parcelas: number,
    percentualCartao?: number,
  ): TarifaGateway {
    const tabela = this.obterTabela(percentualCartao);

    if (metodo !== MetodoPagamento.CARTAO_CREDITO) return tabela.pix;

    // Taxa base do cartão mais o custo do parcelamento, quando houver.
    const extraParcelas =
      tabela.cartaoPercentualPorParcela * Math.max(0, parcelas - 1);

    return {
      percentual: tabela.cartao.percentual + extraParcelas,
      fixo: tabela.cartao.fixo,
    };
  }

  private numero(chave: string, padrao: number): number {
    const bruto = this.configService.get<string>(chave);
    if (bruto === undefined || bruto === null || bruto === '') return padrao;

    const valor = Number(bruto);
    if (!Number.isFinite(valor) || valor < 0) {
      this.logger.warn(`${chave} inválida ("${bruto}"); usando o padrão ${padrao}.`);
      return padrao;
    }
    return valor;
  }
}
