type Decimalish = number | string | { toString(): string } | null | undefined;

export interface ValoresPagamento {
  valor: Decimalish;
  valorLiquido?: Decimalish;
  taxaGateway?: Decimalish;
  comissaoPlataforma?: Decimalish;
  gateway?: string | null;
}

function numero(v: Decimalish): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Tarifa do gateway nesta cobranca, sem a nossa comissao.
 *
 * No Mercado Pago o liquido do organizador ja vem sem a tarifa E sem a
 * application_fee, e a coluna taxaGateway gravava `valor - liquido`: comissao
 * mais tarifa. O painel do organizador descontava a comissao de novo (repasse
 * menor que o real) e o do admin nao descontava a tarifa (repasse maior).
 * Linha sem liquido nem tarifa gravados (cartao antigo) devolve 0.
 */
export function tarifaGatewayDoPagamento(p: ValoresPagamento): number {
  const valor = numero(p.valor) ?? 0;
  const liquido = numero(p.valorLiquido);
  const comissao = numero(p.comissaoPlataforma);

  if (p.gateway === 'mercadopago' && liquido !== null && comissao !== null) {
    return Math.max(0, Number((valor - liquido - comissao).toFixed(2)));
  }

  return numero(p.taxaGateway) ?? 0;
}
