import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import {
  cifrarCredencial,
  decifrarCredencial,
} from '../../common/cripto-credencial';

const API = 'https://api.mercadopago.com';
const AUTORIZACAO = 'https://auth.mercadopago.com/authorization';

/** Renova o token com folga, para nunca cobrar com credencial vencida. */
const DIAS_ANTES_DE_RENOVAR = 15;

/** Espera entre tentativas de recuperar a public key de uma conexao antiga. */
const MINUTOS_ENTRE_BACKFILLS = 10;

/**
 * Conexão da conta Mercado Pago do organizador.
 *
 * Diferente do Asaas, não criamos conta para ninguém: o organizador autoriza a
 * nossa aplicação e passamos a cobrar em nome dele, retendo a comissão. O
 * dinheiro cai na conta dele, e é lá que ele saca — por isso não existe mais
 * fluxo de saque no nosso lado.
 */
@Injectable()
export class MercadoPagoOAuthService {
  private readonly logger = new Logger(MercadoPagoOAuthService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private idContaPlataforma: string | null = null;
  /** Ultima tentativa de backfill da public key, por organizador. */
  private readonly ultimoBackfillDeChave = new Map<string, number>();

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.clientId = (this.configService.get<string>('MP_CLIENT_ID') || '').trim();
    this.clientSecret = (
      this.configService.get<string>('MP_CLIENT_SECRET') || ''
    ).trim();
    this.redirectUri = (
      this.configService.get<string>('MP_REDIRECT_URI') || ''
    ).trim();

    if (!this.clientId || !this.clientSecret || !this.redirectUri) {
      this.logger.error(
        'MP_CLIENT_ID, MP_CLIENT_SECRET ou MP_REDIRECT_URI ausentes: organizadores não conseguirão conectar a conta.',
      );
    }
  }

  /**
   * URL para onde mandar o organizador autorizar. O `state` é o id dele,
   * usado no retorno para saber de quem é a autorização.
   */
  montarUrlAutorizacao(organizadorId: string): string {
    if (!this.clientId || !this.redirectUri) {
      throw new BadRequestException(
        'Conexão com o Mercado Pago não configurada. Contate o suporte.',
      );
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      platform_id: 'mp',
      state: organizadorId,
      redirect_uri: this.redirectUri,
    });

    return `${AUTORIZACAO}?${params.toString()}`;
  }

  /** Troca o `code` do retorno pelo token do organizador e guarda cifrado. */
  async conectar(organizadorId: string, code: string) {
    const dados = await this.trocarToken({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri,
    });

    const jaUsada = await this.prisma.organizador.findFirst({
      where: { mpUserId: String(dados.user_id), id: { not: organizadorId } },
      select: { id: true },
    });

    if (jaUsada) {
      throw new BadRequestException(
        'Esta conta do Mercado Pago já está conectada a outro organizador.',
      );
    }

    return this.prisma.organizador.update({
      where: { id: organizadorId },
      data: this.montarDadosToken(dados),
    });
  }

  /**
   * Token válido do organizador, renovando quando estiver perto de vencer.
   * Devolve null quando ele ainda não conectou a conta.
   */
  async obterTokenValido(organizadorId: string): Promise<string | null> {
    const organizador = await this.prisma.organizador.findUnique({
      where: { id: organizadorId },
      select: {
        mpAccessToken: true,
        mpRefreshToken: true,
        mpTokenExpiraEm: true,
      },
    });

    if (!organizador?.mpAccessToken) return null;

    const limite = new Date(
      Date.now() + DIAS_ANTES_DE_RENOVAR * 24 * 60 * 60 * 1000,
    );
    const precisaRenovar =
      !organizador.mpTokenExpiraEm || organizador.mpTokenExpiraEm < limite;

    if (!precisaRenovar) {
      return decifrarCredencial(organizador.mpAccessToken);
    }

    const refresh = decifrarCredencial(organizador.mpRefreshToken);
    if (!refresh) {
      this.logger.error(
        `Organizador ${organizadorId} sem refresh_token legível; será preciso reconectar a conta.`,
      );
      return decifrarCredencial(organizador.mpAccessToken);
    }

    try {
      const dados = await this.trocarToken({
        grant_type: 'refresh_token',
        refresh_token: refresh,
      });

      await this.prisma.organizador.update({
        where: { id: organizadorId },
        data: this.montarDadosToken(dados),
      });

      return dados.access_token;
    } catch (err) {
      // Token antigo ainda pode funcionar; falhar aqui pararia a venda.
      this.logger.error(
        `Falha ao renovar o token do organizador ${organizadorId}: ${err}`,
      );
      return decifrarCredencial(organizador.mpAccessToken);
    }
  }

  /**
   * Public key da conta do organizador, usada no navegador para tokenizar o
   * cartao.
   *
   * O token do cartao pertence a conta que o emitiu: como a cobranca roda com o
   * access token do organizador, tokenizar com a chave da plataforma faz o
   * Mercado Pago recusar o pagamento. Quem conectou antes de guardarmos essa
   * chave nao tem nada gravado, e a renovacao do token e o unico jeito de
   * obte-la sem pedir uma reconexao — por isso o backfill abaixo.
   */
  async obterPublicKey(organizadorId: string): Promise<string | null> {
    const organizador = await this.prisma.organizador.findUnique({
      where: { id: organizadorId },
      select: { mpPublicKey: true, mpRefreshToken: true },
    });

    if (organizador?.mpPublicKey) return organizador.mpPublicKey;
    if (!organizador) return null;

    const refresh = decifrarCredencial(organizador.mpRefreshToken);
    if (!refresh) return null;

    // Sem essa janela, um organizador cujo backfill nao resolve faria o
    // checkout rotacionar o token dele a cada tentativa de pagamento. E uma
    // espera, e nao uma desistencia: uma queda de rede momentanea nao pode
    // deixar o cartao do evento desligado ate o proximo restart.
    const ultima = this.ultimoBackfillDeChave.get(organizadorId) ?? 0;
    if (Date.now() - ultima < MINUTOS_ENTRE_BACKFILLS * 60 * 1000) return null;
    this.ultimoBackfillDeChave.set(organizadorId, Date.now());

    try {
      const dados = await this.trocarToken({
        grant_type: 'refresh_token',
        refresh_token: refresh,
      });

      await this.prisma.organizador.update({
        where: { id: organizadorId },
        data: this.montarDadosToken(dados),
      });

      if (!dados.public_key) {
        this.logger.warn(
          `Mercado Pago nao devolveu public_key do organizador ${organizadorId}; sera preciso reconectar a conta para habilitar o cartao.`,
        );
      }

      return dados.public_key ?? null;
    } catch (err) {
      this.logger.error(
        `Falha ao obter a public key do organizador ${organizadorId}: ${err}`,
      );
      return null;
    }
  }

  /**
   * True quando a conta conectada pelo organizador e a propria conta dona da
   * aplicacao — o caso da plataforma organizando o proprio evento.
   *
   * O Mercado Pago recusa `application_fee` nessa situacao ("You cannot use
   * application_fee with this payment") e a cobranca inteira falha. Como o
   * dinheiro ja cai na nossa conta, nao ha comissao a reter.
   */
  async recebedorEhAPropriaPlataforma(organizadorId: string): Promise<boolean> {
    const idPlataforma = await this.obterIdContaPlataforma();
    if (!idPlataforma) return false;

    const organizador = await this.prisma.organizador.findUnique({
      where: { id: organizadorId },
      select: { mpUserId: true },
    });

    return organizador?.mpUserId === idPlataforma;
  }

  /**
   * Id da conta dona da aplicacao, resolvido uma vez e guardado em memoria.
   *
   * So o sucesso e memorizado: guardar a falha deixaria a comissao sendo
   * enviada de novo depois de uma instabilidade, voltando a derrubar a venda.
   */
  private async obterIdContaPlataforma(): Promise<string | null> {
    if (this.idContaPlataforma) return this.idContaPlataforma;

    const token = (
      this.configService.get<string>('MP_ACCESS_TOKEN') || ''
    ).trim();
    if (!token) return null;

    try {
      const res = await fetch(`${API}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        this.logger.warn(
          `Nao foi possivel identificar a conta da plataforma no Mercado Pago: HTTP ${res.status}.`,
        );
        return null;
      }

      const dados = (await res.json()) as { id: number | string };
      this.idContaPlataforma = String(dados.id);
      return this.idContaPlataforma;
    } catch (err) {
      this.logger.warn(`Falha ao consultar a conta da plataforma: ${err}`);
      return null;
    }
  }

  async desconectar(organizadorId: string) {
    return this.prisma.organizador.update({
      where: { id: organizadorId },
      data: {
        mpUserId: null,
        mpAccessToken: null,
        mpRefreshToken: null,
        mpTokenExpiraEm: null,
        mpConectadoEm: null,
        mpPublicKey: null,
      },
    });
  }

  private montarDadosToken(dados: RespostaToken) {
    return {
      mpUserId: String(dados.user_id),
      mpAccessToken: cifrarCredencial(dados.access_token),
      mpRefreshToken: dados.refresh_token
        ? cifrarCredencial(dados.refresh_token)
        : null,
      mpTokenExpiraEm: new Date(Date.now() + (dados.expires_in ?? 0) * 1000),
      mpConectadoEm: new Date(),
      // A public key nao e segredo (o navegador a expoe), mas nem sempre volta
      // na renovacao: gravar incondicionalmente apagaria a que ja funcionava.
      ...(dados.public_key ? { mpPublicKey: dados.public_key } : {}),
    };
  }

  private async trocarToken(
    extra: Record<string, string>,
  ): Promise<RespostaToken> {
    let res: Response;
    try {
      res = await fetch(`${API}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          ...extra,
        }),
      });
    } catch (err) {
      this.logger.error(`Falha de rede no OAuth do Mercado Pago: ${err}`);
      throw new BadRequestException(
        'Não foi possível falar com o Mercado Pago. Tente novamente.',
      );
    }

    const dados = await res.json().catch(() => ({}));

    if (!res.ok || !dados.access_token) {
      this.logger.error(
        `OAuth do Mercado Pago recusado: ${res.status} ${JSON.stringify(dados)}`,
      );
      throw new BadRequestException(
        dados.message ||
          'O Mercado Pago recusou a autorização. Tente conectar a conta novamente.',
      );
    }

    return dados as RespostaToken;
  }
}

interface RespostaToken {
  access_token: string;
  refresh_token?: string;
  user_id: number | string;
  expires_in?: number;
  /** Chave usada no navegador para tokenizar o cartao na conta do organizador. */
  public_key?: string;
}
