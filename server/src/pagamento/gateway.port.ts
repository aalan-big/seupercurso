/**
 * Contrato do gateway de pagamento.
 *
 * Existe para que trocar de provedor seja escrever um adaptador, e não mexer no
 * fluxo de inscrição — a migração do Asaas para o Mercado Pago mostrou o custo
 * de não ter isso: o nome do gateway aparecia em 25 arquivos.
 */
export const GATEWAY_PAGAMENTO = Symbol('GATEWAY_PAGAMENTO');

export interface ClienteCobranca {
  nome: string;
  cpfCnpj: string;
  email: string;
  telefone?: string | null;
}

export interface GerarPixParams {
  /** Referência nossa devolvida no webhook (id do pedido ou da inscrição). */
  referenciaExterna: string;
  valor: number;
  descricao: string;
  cliente: ClienteCobranca;
  /** Token de recebimento do organizador; sem ele a cobrança é da plataforma. */
  tokenRecebedor?: string | null;
  /** Comissão retida pela plataforma. */
  comissaoPlataforma?: number;
  expiraEm?: Date;
}

export interface ProcessarCartaoParams {
  referenciaExterna: string;
  valor: number;
  descricao: string;
  cliente: ClienteCobranca;
  /** Token do cartão gerado no navegador — dados de cartão nunca chegam aqui. */
  tokenCartao: string;
  parcelas: number;
  metodoBandeira?: string | null;
  emissor?: string | null;
  tokenRecebedor?: string | null;
  comissaoPlataforma?: number;
  remoteIp?: string;
}

export interface ResultadoCobranca {
  gatewayPaymentId: string;
  status: 'APROVADO' | 'PENDENTE' | 'RECUSADO';
  motivoRecusa?: string | null;
  pixCopiaECola?: string | null;
  pixQrCodeUrl?: string | null;
  /**
   * Tarifa que o gateway efetivamente cobrou nesta venda, quando ele informa.
   *
   * E a unica forma de saber a tarifa da conta do organizador: ela depende do
   * prazo de liberacao que ele escolheu e nao ha API que a devolva antes da
   * primeira venda.
   */
  tarifaCobrada?: number | null;
}

export interface ConsultaCobranca {
  status: 'APROVADO' | 'PENDENTE' | 'RECUSADO' | 'ESTORNADO' | 'CANCELADO';
  valor: number;
  valorLiquido: number | null;
  referenciaExterna?: string | null;
}

export interface GatewayPagamento {
  /** Nome curto do provedor, gravado em cada pagamento. */
  readonly nome: string;

  gerarCobrancaPix(params: GerarPixParams): Promise<ResultadoCobranca>;

  processarPagamentoCartao(
    params: ProcessarCartaoParams,
  ): Promise<ResultadoCobranca>;

  consultarCobranca(gatewayPaymentId: string): Promise<ConsultaCobranca | null>;
}
