import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

export interface CriarSubcontaParams {
  nome: string;
  email: string;
  cpfCnpj: string;
  telefone?: string;
  chavePix?: string;
  dataNascimento?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
}

export interface GerarPixParams {
  /** Obrigatório apenas quando `referenciaExterna`/`descricao` não são informados. */
  inscricaoId?: string;
  valor: number;
  cliente: {
    nome: string;
    cpfCnpj: string;
    email: string;
  };
  organizadorWalletId?: string | null;
  comissaoPlataforma?: number;
  /** Sobrescreve o externalReference enviado ao Asaas (padrão: inscricaoId). */
  referenciaExterna?: string;
  /** Sobrescreve a descrição da cobrança (padrão: referência à inscrição). */
  descricao?: string;
}

export interface ProcessarCartaoParams {
  inscricaoId: string;
  valorTotal: number;
  cliente: {
    nome: string;
    cpfCnpj: string;
    email: string;
  };
  cartao: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
    cpfTitular?: string;
    cep?: string;
    numeroResidencia?: string;
  };
  parcelas?: number;
  organizadorWalletId?: string | null;
  comissaoPlataforma?: number;
}

@Injectable()
export class AsaasService {
  private readonly logger = new Logger(AsaasService.name);
  private readonly apiBaseUrl: string;
  private readonly apiKey: string;
  private readonly isProd: boolean;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = (this.configService.get<string>('ASAAS_API_KEY') || '').trim();
    const asaasEnv = this.configService.get<string>('ASAAS_ENV')?.toLowerCase();
    const isKeySandbox = this.apiKey.includes('hmlg') || this.apiKey.includes('sandbox');

    if (asaasEnv === 'production') {
      this.isProd = true;
    } else if (asaasEnv === 'sandbox') {
      this.isProd = false;
    } else {
      // Auto-detecta: se a chave começar com $aact_hmlg_ usa Sandbox mesmo com NODE_ENV=production
      this.isProd = this.configService.get<string>('NODE_ENV') === 'production' && !isKeySandbox;
    }

    this.apiBaseUrl = this.isProd
      ? 'https://api.asaas.com/v3'
      : 'https://sandbox.asaas.com/api/v3';

    this.logger.log(`Asaas inicializado em modo: ${this.isProd ? 'PRODUÇÃO (api.asaas.com)' : 'SANDBOX / HOMOLOGAÇÃO (sandbox.asaas.com)'}`);
  }

  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      access_token: this.apiKey,
    };
  }

  /**
   * Cria uma subconta no Asaas para o organizador receber os pagamentos diretamente com split.
   */
  async criarSubcontaOrganizador(params: CriarSubcontaParams) {
    if (!this.apiKey) {
      this.logger.warn('ASAAS_API_KEY não configurada. Usando walletId de mock.');
      return { accountId: `acc_mock_${Date.now()}`, walletId: `wal_mock_${Date.now()}` };
    }

    const body = {
      name: params.nome,
      email: params.email,
      cpfCnpj: params.cpfCnpj.replace(/\D/g, ''),
      mobilePhone: params.telefone ? params.telefone.replace(/\D/g, '') : '88999999999',
      birthDate: params.dataNascimento,
      postalCode: params.cep?.replace(/\D/g, ''),
      address: params.logradouro,
      addressNumber: params.numero,
      complement: params.complemento || undefined,
      province: params.bairro,
    };

    try {
      const response = await fetch(`${this.apiBaseUrl}/accounts`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        this.logger.error(`Erro ao criar subconta Asaas: ${JSON.stringify(data)}`);
        if (data.errors && data.errors[0]?.code === 'invalid_cpfCnpj') {
          throw new BadRequestException('CPF/CNPJ inválido para conta Asaas.');
        }
        throw new BadRequestException(data.errors?.[0]?.description || 'Erro ao criar subconta Asaas.');
      }

      return {
        accountId: data.id,
        walletId: data.walletId || data.id,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(`Falha ao conectar no Asaas para criar Subconta: ${error}`);
      throw new BadRequestException('Não foi possível conectar ao Asaas para ativar a conta do organizador.');
    }
  }

  /**
   * Gera uma cobrança PIX com QR Code e Copia e Cola no Asaas (com Split de Pagamento)
   */
  async gerarCobrancaPix(params: GerarPixParams) {
    const split = params.organizadorWalletId && !params.organizadorWalletId.startsWith('wal_mock_')
      ? [
          {
            walletId: params.organizadorWalletId,
            fixedValue: Math.max(0, params.valor - (params.comissaoPlataforma || 0)),
          },
        ]
      : undefined;

    const referenciaExterna = params.referenciaExterna ?? params.inscricaoId ?? randomUUID();

    const body = {
      customer: await this.obterOuCriarClienteAsaas(params.cliente),
      billingType: 'PIX',
      value: params.valor,
      dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10), // Vencimento em 24h
      description: params.descricao ?? `Inscrição no Evento (Ref: ${(params.inscricaoId ?? referenciaExterna).slice(0, 8)})`,
      externalReference: referenciaExterna,
      ...(split ? { split } : {}),
    };

    try {
      const resPayment = await fetch(`${this.apiBaseUrl}/payments`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      });

      const paymentData = await resPayment.json();
      if (!resPayment.ok) {
        const errorDesc = paymentData.errors?.[0]?.description || 'Erro ao gerar PIX no gateway.';
        this.logger.error(`Erro Asaas ao gerar cobrança PIX: ${JSON.stringify(paymentData)}`);
        throw new BadRequestException(`Erro Asaas: ${errorDesc}`);
      }

      // Buscar o QR Code do PIX gerado
      const resQr = await fetch(`${this.apiBaseUrl}/payments/${paymentData.id}/pixQrCode`, {
        headers: this.getHeaders(),
      });
      const qrData = await resQr.json();

      if (!resQr.ok) {
        this.logger.error(`Erro ao obter QR Code PIX do Asaas: ${JSON.stringify(qrData)}`);
      }

      return {
        asaasPaymentId: paymentData.id,
        pixCopiaECola: qrData.payload || paymentData.invoiceUrl || paymentData.bankSlipUrl,
        pixQrCodeUrl: qrData.encodedImage ? `data:image/png;base64,${qrData.encodedImage}` : null,
      };
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error(`Falha ao conectar com o gateway Asaas para PIX: ${err.message || err}`);
      throw new BadRequestException('Erro ao comunicar com o Asaas para gerar o PIX. Verifique as credenciais da API.');
    }
  }

  /**
   * Processa pagamento em Cartão de Crédito com antecipação em D+2 e Split Automático
   */
  async processarPagamentoCartao(params: ProcessarCartaoParams) {
    const split = params.organizadorWalletId && !params.organizadorWalletId.startsWith('wal_mock_')
      ? [
          {
            walletId: params.organizadorWalletId,
            fixedValue: Math.max(0, params.valorTotal - (params.comissaoPlataforma || 0)),
          },
        ]
      : undefined;

    const body = {
      customer: await this.obterOuCriarClienteAsaas(params.cliente),
      billingType: 'CREDIT_CARD',
      value: params.valorTotal,
      dueDate: new Date().toISOString().slice(0, 10),
      description: `Inscrição no Evento (Ref: ${params.inscricaoId.slice(0, 8)})`,
      externalReference: params.inscricaoId,
      ...(params.parcelas && params.parcelas > 1
        ? {
            installmentCount: params.parcelas,
            installmentValue: Number((params.valorTotal / params.parcelas).toFixed(2)),
          }
        : {}),
      creditCard: {
        holderName: params.cartao.holderName,
        number: params.cartao.number.replace(/\D/g, ''),
        expiryMonth: params.cartao.expiryMonth,
        expiryYear: params.cartao.expiryYear,
        ccv: params.cartao.ccv,
      },
      creditCardHolderInfo: {
        name: params.cartao.holderName || params.cliente.nome,
        email: params.cliente.email,
        cpfCnpj: (params.cartao.cpfTitular || params.cliente.cpfCnpj).replace(/\D/g, ''),
        postalCode: (params.cartao.cep || (params.cliente as any).endereco?.cep || '60000000').replace(/\D/g, ''),
        addressNumber: params.cartao.numeroResidencia || (params.cliente as any).endereco?.numero || '100',
        mobilePhone: '88999999999',
      },
      ...(split ? { split } : {}),
    };

    try {
      const res = await fetch(`${this.apiBaseUrl}/payments`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        const errorDesc = data.errors?.[0]?.description || 'Cartão recusado. Verifique os dados.';
        this.logger.error(`Erro Asaas ao processar Cartão: ${JSON.stringify(data)}`);
        throw new BadRequestException(errorDesc);
      }

      return {
        asaasPaymentId: data.id,
        status: data.status === 'CONFIRMED' || data.status === 'RECEIVED' ? 'APROVADO' : 'PENDENTE',
      };
    } catch (e: any) {
      if (e instanceof BadRequestException) throw e;
      this.logger.error(`Falha ao conectar com gateway Asaas para Cartão: ${e.message || e}`);
      throw new BadRequestException('Erro ao processar cartão no gateway de pagamento. Verifique os dados ou tente novamente.');
    }
  }

  /**
   * Realiza o saque/transferência via PIX da subconta do organizador para a chave PIX dele
   * Omitimos scheduleDate para que o Asaas execute a transferência imediatamente em vez de agendar e expirar.
   */
  async solicitarSaquePix(params: { valor: number; chavePix: string; walletId?: string | null }) {
    const body = {
      value: params.valor,
      pixAddressKey: params.chavePix,
      description: 'Saque de Vendas de Inscrições - SeuPercurso',
    };

    try {
      const response = await fetch(`${this.apiBaseUrl}/transfers`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (!response.ok) {
        const errorMsg = data.errors?.[0]?.description || 'Erro ao processar transferência via PIX no Asaas.';
        this.logger.error(`Erro Asaas ao solicitar saque: ${JSON.stringify(data)}`);
        throw new BadRequestException(errorMsg);
      }

      return {
        transferId: data.id,
        status: data.status || 'DONE',
        valor: data.value,
      };
    } catch (error: any) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(`Falha ao solicitar saque no Asaas: ${error.message || error}`);
      throw new BadRequestException('Não foi possível processar a transferência PIX no momento. Tente novamente mais tarde.');
    }
  }

  private async obterOuCriarClienteAsaas(cliente: { nome: string; cpfCnpj: string; email: string }) {
    const doc = cliente.cpfCnpj.replace(/\D/g, '');
    try {
      const searchRes = await fetch(`${this.apiBaseUrl}/customers?cpfCnpj=${doc}`, {
        headers: this.getHeaders(),
      });
      const searchData = await searchRes.json();

      if (searchData.data && searchData.data.length > 0) {
        return searchData.data[0].id;
      }

      const createRes = await fetch(`${this.apiBaseUrl}/customers`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          name: cliente.nome,
          email: cliente.email,
          cpfCnpj: doc,
        }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) {
        this.logger.warn(`Erro ao criar cliente Asaas: ${JSON.stringify(createData)}`);
      }
      return createData.id || `cus_mock_${Date.now()}`;
    } catch (err) {
      this.logger.warn(`Erro ao obter/criar cliente no Asaas: ${err}`);
      return `cus_mock_${Date.now()}`;
    }
  }
}
