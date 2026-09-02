import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MetodoPagamento } from '../generated/prisma/enums';

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

  constructor(private readonly configService: ConfigService) {}

  obterTabela(): TabelaTarifas {
    return {
      pix: {
        percentual: this.numero('TARIFA_PIX_PERCENTUAL', 0.0099),
        fixo: this.numero('TARIFA_PIX_FIXA', 0),
      },
      cartao: {
        percentual: this.numero('TARIFA_CARTAO_PERCENTUAL', 0.0398),
        fixo: this.numero('TARIFA_CARTAO_FIXA', 0),
      },
      cartaoPercentualPorParcela: this.numero(
        'TARIFA_CARTAO_PERCENTUAL_PARCELA',
        0,
      ),
      maxParcelas: this.numero('MAX_PARCELAS', 12),
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
  ): number {
    const tarifa = this.tarifaDe(metodo, parcelas);

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
  estimarTarifa(valorBase: number, metodo: MetodoPagamento, parcelas = 1): number {
    return Number(
      (this.calcularValorCobrado(valorBase, metodo, parcelas) - valorBase).toFixed(2),
    );
  }

  /** Opções de parcelamento com o valor já acrescido da tarifa. */
  calcularOpcoesParcelamento(valorBase: number) {
    const { maxParcelas, valorMinimoParcela } = this.obterTabela();
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
      );
      return {
        num,
        total,
        parcela: Number((total / num).toFixed(2)),
      };
    });
  }

  private tarifaDe(metodo: MetodoPagamento, parcelas: number): TarifaGateway {
    const tabela = this.obterTabela();

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
