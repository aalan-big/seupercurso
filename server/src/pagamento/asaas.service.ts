import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import {
  VALOR_MINIMO_COBRANCA,
  valorEhCobravel,
} from '../common/validators/is-valor-cobravel.validator';

export interface CriarSubcontaParams {
  nome: string;
  email: string;
  cpfCnpj: string;
  /** Renda mensal (PF) ou faturamento mensal (PJ). Obrigatório no Asaas. */
  rendaFaturamentoMensal: number;
  /** Natureza jurídica (MEI/LIMITED/INDIVIDUAL/ASSOCIATION). Obrigatório quando é CNPJ. */
  tipoEmpresa?: string | null;
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
  /** Quanto do valor cobrado pertence ao organizador (já descontada a comissão). */
  valorLiquidoOrganizador?: number;
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
    telefone?: string | null;
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
  /** Quanto do valor cobrado pertence ao organizador (já descontada a comissão). */
  valorLiquidoOrganizador?: number;
  /** IP de origem do comprador, exigido pelo antifraude do Asaas. */
  remoteIp?: string;
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

    if (this.isProd && isKeySandbox) {
      throw new Error(
        'ASAAS_ENV=production foi definido, mas a ASAAS_API_KEY é de homologação ($aact_hmlg_). ' +
          'Use a chave de produção ou defina ASAAS_ENV=sandbox.',
      );
    }

    this.apiBaseUrl = this.isProd
      ? 'https://api.asaas.com/v3'
      : 'https://sandbox.asaas.com/api/v3';

    this.logger.log(`Asaas inicializado em modo: ${this.isProd ? 'PRODUÇÃO (api.asaas.com)' : 'SANDBOX / HOMOLOGAÇÃO (sandbox.asaas.com)'}`);

    // Alerta ruidoso: aplicação rodando como produção contra o sandbox significa
    // que nenhuma cobrança gerada aos clientes é real.
    if (!this.isProd && this.configService.get<string>('NODE_ENV') === 'production') {
      this.logger.error(
        '*** ATENÇÃO: a API está em NODE_ENV=production mas o Asaas está em SANDBOX. ' +
          'Nenhuma cobrança PIX/cartão gerada será cobrada de verdade. ' +
          'Defina ASAAS_API_KEY de produção e ASAAS_ENV=production para faturar. ***',
      );
    }

    if (!this.apiKey) {
      this.logger.error('ASAAS_API_KEY não configurada: cobranças PIX/cartão irão falhar.');
    }
  }

  /**
   * Monta o split do organizador em percentual do valor cobrado.
   *
   * Usamos `percentualValue` em vez de `fixedValue` porque em cobranças parceladas
   * o Asaas aplica o split a cada parcela — um valor fixo seria repassado N vezes.
   */
  private montarSplit(
    walletId: string | null | undefined,
    valorCobrado: number,
    valorLiquidoOrganizador?: number,
  ) {
    if (!walletId || walletId.startsWith('wal_mock_')) return undefined;
    if (!valorCobrado || valorCobrado <= 0) return undefined;

    const liquido = Math.max(0, Math.min(valorLiquidoOrganizador ?? 0, valorCobrado));
    const percentual = Number(((liquido / valorCobrado) * 100).toFixed(2));
    if (percentual <= 0) return undefined;

    return [{ walletId, percentualValue: percentual }];
  }

  /**
   * Cabeçalhos da API. Sem `apiKey` usa a chave da plataforma; com ela, a
   * requisição acontece dentro da subconta do organizador — é assim que o saque
   * sai do saldo dele e não do nosso.
   */
  private getHeaders(apiKey?: string | null) {
    return {
      'Content-Type': 'application/json',
      access_token: apiKey || this.apiKey,
    };
  }

  /**
   * Cria uma subconta no Asaas para o organizador receber os pagamentos diretamente com split.
   */
  async criarSubcontaOrganizador(params: CriarSubcontaParams) {
    if (!this.apiKey) {
      this.logger.warn('ASAAS_API_KEY não configurada. Usando walletId de mock.');
      return {
        accountId: `acc_mock_${Date.now()}`,
        walletId: `wal_mock_${Date.now()}`,
        apiKey: null,
      };
    }

    if (!params.rendaFaturamentoMensal || params.rendaFaturamentoMensal <= 0) {
      throw new BadRequestException(
        'Informe a renda mensal (pessoa física) ou o faturamento mensal (pessoa jurídica) para abrir a conta de recebimento.',
      );
    }

    const documento = params.cpfCnpj.replace(/\D/g, '');
    const ehPessoaJuridica = documento.length === 14;

    if (ehPessoaJuridica && !params.tipoEmpresa) {
      throw new BadRequestException(
        'Informe a natureza jurídica da empresa (MEI, LTDA, Empresário Individual ou Associação) para abrir a conta de recebimento.',
      );
    }

    const body = {
      name: params.nome,
      email: params.email,
      cpfCnpj: documento,
      // Obrigatório para contas PJ; enviar em conta PF faz o Asaas recusar.
      ...(ehPessoaJuridica ? { companyType: params.tipoEmpresa } : {}),
      // Exigido pelo Asaas em POST /accounts: sem ele a subconta nunca era criada,
      // o organizador ficava sem walletId e o split nao acontecia.
      incomeValue: params.rendaFaturamentoMensal,
      mobilePhone: params.telefone ? params.telefone.replace(/\D/g, '') : '88999999999',
      // Data de nascimento so faz sentido em conta PF.
      ...(ehPessoaJuridica ? {} : { birthDate: params.dataNascimento }),
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

        const descricao: string = data.errors?.[0]?.description || '';

        if (data.errors?.[0]?.code === 'invalid_cpfCnpj') {
          throw new BadRequestException('CPF/CNPJ inválido para conta Asaas.');
        }

        // O Asaas exige e-mail único em toda a plataforma. A mensagem crua dele
        // não diz o que fazer, e o organizador fica travado sem entender.
        if (/e-?mail.*(já|ja).*(uso|cadastrad)/i.test(descricao)) {
          throw new BadRequestException(
            `Este e-mail já pertence a outra conta no Asaas (${params.email}). ` +
              'Informe um e-mail diferente no campo "E-mail da conta de recebimento" para abrir sua conta.',
          );
        }

        if (/cpf|cnpj/i.test(descricao) && /(já|ja).*(uso|cadastrad)/i.test(descricao)) {
          throw new BadRequestException(
            'Este CPF/CNPJ já possui uma conta no Asaas. Entre em contato com o suporte para vincular a conta existente.',
          );
        }

        throw new BadRequestException(descricao || 'Erro ao criar subconta Asaas.');
      }

      // O Asaas devolve a apiKey da subconta uma única vez, na criação. Sem
      // guardá-la, não há como o organizador sacar o próprio saldo pelo site.
      if (!data.apiKey) {
        this.logger.warn(
          `Subconta ${data.id} criada sem apiKey na resposta do Asaas; o saque pelo site ficará indisponível.`,
        );
      }

      return {
        accountId: data.id,
        walletId: data.walletId || data.id,
        apiKey: (data.apiKey as string | undefined) || null,
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
    this.validarValorCobranca(params.valor);

    const split = this.montarSplit(
      params.organizadorWalletId,
      params.valor,
      params.valorLiquidoOrganizador,
    );

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
    this.validarValorCobranca(params.valorTotal);
    this.validarDadosCartao(params.cartao);

    const split = this.montarSplit(
      params.organizadorWalletId,
      params.valorTotal,
      params.valorLiquidoOrganizador,
    );

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
        postalCode: params.cartao.cep!.replace(/\D/g, ''),
        addressNumber: params.cartao.numeroResidencia!,
        ...(params.cliente.telefone
          ? { mobilePhone: params.cliente.telefone.replace(/\D/g, '') }
          : {}),
      },
      // O antifraude do Asaas exige o IP de origem do comprador em cobranças de cartão.
      ...(params.remoteIp ? { remoteIp: params.remoteIp } : {}),
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
   * Transfere o saldo da subconta do organizador para a chave PIX dele.
   *
   * Roda com a apiKey da subconta: o dinheiro sai do saldo que o split creditou
   * ao organizador, não do caixa da plataforma. A chave de destino é sempre o
   * CPF/CNPJ do titular, então o Banco Central garante que o crédito cai na
   * conta dessa mesma pessoa, em qualquer banco.
   */
  async solicitarSaquePix(params: {
    valor: number;
    cpfCnpjTitular: string;
    apiKeySubconta: string;
  }) {
    const documento = params.cpfCnpjTitular.replace(/\D/g, '');

    if (documento.length !== 11 && documento.length !== 14) {
      throw new BadRequestException(
        'CPF/CNPJ do titular inválido para a transferência.',
      );
    }

    const body = {
      value: params.valor,
      pixAddressKey: documento,
      pixAddressKeyType: documento.length === 11 ? 'CPF' : 'CNPJ',
      description: 'Saque de Vendas de Inscrições - SeuPercurso',
    };

    try {
      const response = await fetch(`${this.apiBaseUrl}/transfers`, {
        method: 'POST',
        headers: this.getHeaders(params.apiKeySubconta),
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

  /**
   * Saldo real da subconta do organizador. É a única fonte confiável do quanto
   * ele pode sacar — nosso cálculo de repasse não conhece taxas, estornos nem
   * o prazo de liberação do cartão.
   */
  async consultarSaldoSubconta(apiKeySubconta: string): Promise<number | null> {
    if (!apiKeySubconta) return null;

    try {
      const res = await fetch(`${this.apiBaseUrl}/finance/balance`, {
        headers: this.getHeaders(apiKeySubconta),
      });
      if (!res.ok) {
        this.logger.warn(`Nao foi possivel consultar o saldo da subconta: HTTP ${res.status}`);
        return null;
      }

      const data = await res.json();
      return Number(data.balance ?? 0);
    } catch (err) {
      this.logger.warn(`Falha ao consultar saldo da subconta no Asaas: ${err}`);
      return null;
    }
  }

  /**
   * O Asaas recusa qualquer cobrança abaixo de R$ 5,00. Barramos antes de chamar
   * a API para o comprador receber uma mensagem clara em vez do erro cru do gateway.
   */
  private validarValorCobranca(valor: number) {
    if (!valorEhCobravel(valor) || valor <= 0) {
      throw new BadRequestException(
        `O valor mínimo de uma cobrança é R$ ${VALOR_MINIMO_COBRANCA.toFixed(2)}. Valor solicitado: R$ ${Number(valor || 0).toFixed(2)}.`,
      );
    }
  }

  /**
   * Rejeita cobranças de cartão incompletas em vez de completá-las com dados
   * fictícios — um cartão "de teste" preenchido pelo servidor aprovaria uma
   * inscrição que o comprador nunca pagou.
   */
  private validarDadosCartao(cartao: ProcessarCartaoParams['cartao']) {
    const faltando: string[] = [];

    if (!cartao.holderName?.trim()) faltando.push('nome impresso no cartão');
    if (!cartao.number?.replace(/\D/g, '')) faltando.push('número do cartão');
    if (!cartao.expiryMonth?.trim()) faltando.push('mês de validade');
    if (!cartao.expiryYear?.trim()) faltando.push('ano de validade');
    if (!cartao.ccv?.trim()) faltando.push('código de segurança (CVV)');
    if (!cartao.cpfTitular?.replace(/\D/g, '')) faltando.push('CPF/CNPJ do titular');
    if (!cartao.cep?.replace(/\D/g, '')) faltando.push('CEP do titular');
    if (!cartao.numeroResidencia?.trim()) faltando.push('número do endereço do titular');

    if (faltando.length > 0) {
      throw new BadRequestException(
        `Dados do cartão incompletos: informe ${faltando.join(', ')}.`,
      );
    }

    const numero = cartao.number.replace(/\D/g, '');
    if (numero.length < 13 || numero.length > 19) {
      throw new BadRequestException('Número de cartão inválido.');
    }
  }

  /**
   * Consulta o status atual de uma cobrança no Asaas.
   * Usada para reconciliar quando o webhook não chega.
   */
  async consultarPagamento(asaasPaymentId: string) {
    if (!this.apiKey || !asaasPaymentId || asaasPaymentId.startsWith('pay_mock_')) {
      return null;
    }

    try {
      const res = await fetch(`${this.apiBaseUrl}/payments/${asaasPaymentId}`, {
        headers: this.getHeaders(),
      });
      if (!res.ok) return null;

      const data = await res.json();
      return {
        status: data.status as string,
        valor: Number(data.value ?? 0),
        externalReference: data.externalReference as string | undefined,
      };
    } catch (err) {
      this.logger.warn(`Falha ao consultar pagamento ${asaasPaymentId} no Asaas: ${err}`);
      return null;
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
