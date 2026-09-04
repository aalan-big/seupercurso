import { randomUUID } from 'crypto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConsultaCobranca,
  GatewayPagamento,
  GerarPixParams,
  ProcessarCartaoParams,
  ResultadoCobranca,
} from '../gateway.port';
import {
  VALOR_MINIMO_COBRANCA,
  valorEhCobravel,
} from '../../common/validators/is-valor-cobravel.validator';

const API = 'https://api.mercadopago.com';

/** Status do Mercado Pago mapeados para os nossos. */
const STATUS: Record<string, ConsultaCobranca['status']> = {
  approved: 'APROVADO',
  authorized: 'APROVADO',
  pending: 'PENDENTE',
  in_process: 'PENDENTE',
  in_mediation: 'PENDENTE',
  rejected: 'RECUSADO',
  cancelled: 'CANCELADO',
  refunded: 'ESTORNADO',
  charged_back: 'ESTORNADO',
};

@Injectable()
export class MercadoPagoService implements GatewayPagamento {
  readonly nome = 'mercadopago';

  private readonly logger = new Logger(MercadoPagoService.name);
  private readonly accessTokenPlataforma: string;
  private readonly notificationUrl?: string;

  constructor(private readonly configService: ConfigService) {
    this.accessTokenPlataforma = (
      this.configService.get<string>('MP_ACCESS_TOKEN') || ''
    ).trim();

    const apiUrl = this.configService.get<string>('API_URL');
    this.notificationUrl = apiUrl
      ? `${apiUrl.replace(/\/$/, '')}/pagamento/webhook/mercadopago`
      : undefined;

    if (!this.accessTokenPlataforma) {
      this.logger.error(
        'MP_ACCESS_TOKEN não configurada: as cobranças irão falhar.',
      );
    } else if (this.accessTokenPlataforma.startsWith('TEST-')) {
      this.logger.warn(
        '*** Mercado Pago em credenciais de TESTE: nenhuma cobrança é real. ***',
      );
    } else {
      this.logger.log('Mercado Pago inicializado em modo PRODUÇÃO.');
    }

    if (!this.notificationUrl) {
      this.logger.warn(
        'API_URL não configurada: o Mercado Pago não terá para onde notificar os pagamentos.',
      );
    }
  }

  async gerarCobrancaPix(params: GerarPixParams): Promise<ResultadoCobranca> {
    this.validarValor(params.valor);

    const [nome, ...sobrenome] = params.cliente.nome.trim().split(/\s+/);

    const body = {
      transaction_amount: Number(params.valor.toFixed(2)),
      payment_method_id: 'pix',
      description: params.descricao,
      external_reference: params.referenciaExterna,
      ...(this.notificationUrl ? { notification_url: this.notificationUrl } : {}),
      ...(params.expiraEm
        ? { date_of_expiration: params.expiraEm.toISOString() }
        : {}),
      ...this.montarComissao(params.tokenRecebedor, params.comissaoPlataforma),
      payer: this.montarPagador(params.cliente, nome, sobrenome.join(' ')),
    };

    const data = await this.post('/v1/payments', body, params.tokenRecebedor);
    const transacao = data.point_of_interaction?.transaction_data;

    return {
      gatewayPaymentId: String(data.id),
      status: STATUS[data.status] === 'APROVADO' ? 'APROVADO' : 'PENDENTE',
      pixCopiaECola: transacao?.qr_code ?? null,
      pixQrCodeUrl: transacao?.qr_code_base64
        ? `data:image/png;base64,${transacao.qr_code_base64}`
        : null,
    };
  }

  async processarPagamentoCartao(
    params: ProcessarCartaoParams,
  ): Promise<ResultadoCobranca> {
    this.validarValor(params.valor);

    if (!params.tokenCartao) {
      throw new BadRequestException(
        'Não foi possível validar os dados do cartão. Tente novamente.',
      );
    }

    const [nome, ...sobrenome] = params.cliente.nome.trim().split(/\s+/);

    const body = {
      transaction_amount: Number(params.valor.toFixed(2)),
      token: params.tokenCartao,
      installments: Math.max(1, params.parcelas || 1),
      description: params.descricao,
      external_reference: params.referenciaExterna,
      ...(params.metodoBandeira ? { payment_method_id: params.metodoBandeira } : {}),
      ...(params.emissor ? { issuer_id: params.emissor } : {}),
      ...(this.notificationUrl ? { notification_url: this.notificationUrl } : {}),
      ...this.montarComissao(params.tokenRecebedor, params.comissaoPlataforma),
      payer: this.montarPagador(params.cliente, nome, sobrenome.join(' ')),
    };

    const data = await this.post('/v1/payments', body, params.tokenRecebedor, {
      ...(params.remoteIp ? { 'X-Forwarded-For': params.remoteIp } : {}),
    });

    const status = STATUS[data.status] ?? 'PENDENTE';

    if (status === 'RECUSADO') {
      throw new BadRequestException(
        this.traduzirRecusa(data.status_detail) ||
          'Cartão recusado. Verifique os dados ou tente outro cartão.',
      );
    }

    return {
      gatewayPaymentId: String(data.id),
      status: status === 'APROVADO' ? 'APROVADO' : 'PENDENTE',
      motivoRecusa: data.status_detail ?? null,
      tarifaCobrada: this.extrairTarifa(data),
    };
  }

  /**
   * Tarifa que o Mercado Pago reteve do vendedor nesta venda.
   *
   * So conta o que e cobrado de quem recebe (`collector`): juros de
   * parcelamento pago pelo comprador aparece na mesma lista e nao e custo do
   * organizador.
   */
  private extrairTarifa(data: any): number | null {
    const detalhes = Array.isArray(data?.fee_details) ? data.fee_details : [];

    const total = detalhes
      .filter((d: any) => !d?.fee_payer || d.fee_payer === 'collector')
      .reduce((soma: number, d: any) => soma + Number(d?.amount ?? 0), 0);

    return Number.isFinite(total) && total > 0 ? Number(total.toFixed(2)) : null;
  }

  async consultarCobranca(
    gatewayPaymentId: string,
  ): Promise<ConsultaCobranca | null> {
    if (!gatewayPaymentId) return null;

    try {
      const res = await fetch(`${API}/v1/payments/${gatewayPaymentId}`, {
        headers: { Authorization: `Bearer ${this.accessTokenPlataforma}` },
      });
      if (!res.ok) return null;

      const data = await res.json();
      return {
        status: STATUS[data.status] ?? 'PENDENTE',
        valor: Number(data.transaction_amount ?? 0),
        // net_received_amount ja desconta a tarifa do Mercado Pago.
        valorLiquido:
          data.transaction_details?.net_received_amount === undefined
            ? null
            : Number(data.transaction_details.net_received_amount),
        referenciaExterna: data.external_reference ?? null,
      };
    } catch (err) {
      this.logger.warn(`Falha ao consultar pagamento ${gatewayPaymentId}: ${err}`);
      return null;
    }
  }

  /**
   * A comissão só existe quando a cobrança roda na conta do organizador. Sem
   * token dele o dinheiro é nosso por inteiro e cobrar `application_fee` de nós
   * mesmos seria recusado.
   */
  private montarComissao(tokenRecebedor?: string | null, comissao?: number) {
    if (!tokenRecebedor || !comissao || comissao <= 0) return {};
    return { application_fee: Number(comissao.toFixed(2)) };
  }

  private montarPagador(
    cliente: GerarPixParams['cliente'],
    nome: string,
    sobrenome: string,
  ) {
    const documento = cliente.cpfCnpj.replace(/\D/g, '');

    return {
      email: cliente.email,
      first_name: nome,
      ...(sobrenome ? { last_name: sobrenome } : {}),
      ...(documento
        ? {
            identification: {
              type: documento.length === 14 ? 'CNPJ' : 'CPF',
              number: documento,
            },
          }
        : {}),
    };
  }

  private async post(
    caminho: string,
    body: unknown,
    tokenRecebedor?: string | null,
    headersExtra: Record<string, string> = {},
  ) {
    const token = tokenRecebedor || this.accessTokenPlataforma;

    if (!token) {
      throw new BadRequestException(
        'Gateway de pagamento não configurado. Contate o suporte.',
      );
    }

    let res: Response;
    try {
      res = await fetch(`${API}${caminho}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          // Evita cobranca duplicada se a requisicao for reenviada.
          'X-Idempotency-Key': randomUUID(),
          ...headersExtra,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      this.logger.error(`Falha de rede ao chamar o Mercado Pago: ${err}`);
      throw new BadRequestException(
        'Não foi possível falar com o gateway de pagamento. Tente novamente.',
      );
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      this.logger.error(
        `Erro do Mercado Pago em ${caminho}: ${res.status} ${JSON.stringify(data)}`,
      );
      throw new BadRequestException(
        this.traduzirErro(data) || 'Erro ao processar o pagamento.',
      );
    }

    return data;
  }

  private validarValor(valor: number) {
    if (!valorEhCobravel(valor) || valor <= 0) {
      throw new BadRequestException(
        `O valor mínimo de uma cobrança é R$ ${VALOR_MINIMO_COBRANCA.toFixed(2)}. Valor solicitado: R$ ${Number(valor || 0).toFixed(2)}.`,
      );
    }
  }

  private traduzirErro(data: any): string | null {
    const causa = data?.cause?.[0]?.description || data?.cause?.[0]?.code;
    return data?.message ? String(causa || data.message) : null;
  }

  /** As mensagens do Mercado Pago são códigos; o comprador precisa de instrução. */
  private traduzirRecusa(detalhe?: string): string | null {
    const mapa: Record<string, string> = {
      cc_rejected_insufficient_amount: 'Cartão sem saldo suficiente.',
      cc_rejected_bad_filled_security_code: 'Código de segurança inválido.',
      cc_rejected_bad_filled_date: 'Data de validade inválida.',
      cc_rejected_bad_filled_card_number: 'Número do cartão inválido.',
      cc_rejected_bad_filled_other: 'Dados do cartão incorretos. Confira e tente de novo.',
      cc_rejected_call_for_authorize:
        'Seu banco precisa autorizar esta compra. Ligue para ele e tente novamente.',
      cc_rejected_card_disabled: 'Cartão desabilitado. Fale com o seu banco.',
      cc_rejected_duplicated_payment:
        'Já existe um pagamento igual a este. Confira antes de tentar de novo.',
      cc_rejected_high_risk:
        'Pagamento recusado por segurança. Tente outro cartão ou pague no PIX.',
      cc_rejected_max_attempts:
        'Muitas tentativas com este cartão. Tente outro cartão.',
    };

    return detalhe ? (mapa[detalhe] ?? null) : null;
  }
}
