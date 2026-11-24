import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  CategoriaAuditLog,
  MetodoPagamento,
  NivelAuditLog,
  StatusEvento,
  StatusInscricao,
  StatusPagamento,
} from '../generated/prisma/enums';
import { AuditLogService } from '../audit-log/audit-log.service';
import { EmailService } from '../email/email.service';
import { GATEWAY_PAGAMENTO, type GatewayPagamento } from './gateway.port';
import { MercadoPagoOAuthService } from './mercadopago/mercadopago-oauth.service';
import { PagamentoService } from './pagamento.service';
import {
  HORAS_PRAZO_PAGAMENTO,
  lerModoExpiracao,
  prazoPagamento,
  type ModoExpiracao,
} from './prazo-pagamento';

const HORA_MS = 3600_000;
const INTERVALO_MS = 10 * 60_000;
const HORAS_ATE_LEMBRETE = 2;
const MARCA_LEMBRETE = 'Lembrete de pagamento enviado: ';

const INCLUDE = {
  cliente: { include: { pf: true, pj: true, usuario: true } },
  pagamentos: true,
  pedido: { include: { pagamentos: true } },
  categoria: { include: { modalidade: { include: { evento: true } } } },
} as const;

interface PagamentoAprovado {
  gatewayPaymentId: string;
  referenciaExterna: string;
  valor: number;
  valorLiquido: number | null;
  metodo: MetodoPagamento;
}

type Situacao =
  | { tipo: 'NAO_PAGO' }
  | { tipo: 'PAGO'; pagamento: PagamentoAprovado }
  | { tipo: 'AGUARDAR'; motivo: string };

type Grupo = Awaited<ReturnType<ExpiracaoInscricaoService['buscarInscricoes']>>;

/**
 * Libera a vaga de quem nao pagou no prazo e lembra quem ainda pode pagar.
 *
 * Regra de ouro: na duvida, nao expira. O webhook pode falhar, entao quem diz
 * se foi pago e sempre uma consulta ao gateway feita na hora.
 */
@Injectable()
export class ExpiracaoInscricaoService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ExpiracaoInscricaoService.name);
  private readonly modo: ModoExpiracao;
  private timer?: NodeJS.Timeout;
  private inicio?: NodeJS.Timeout;
  private rodando = false;
  /** Grupos sem decisao: so voltam a ser consultados depois deste instante. */
  private readonly proximaTentativa = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly pagamentoService: PagamentoService,
    private readonly mpOAuthService: MercadoPagoOAuthService,
    private readonly emailService: EmailService,
    private readonly auditLogService: AuditLogService,
    @Inject(GATEWAY_PAGAMENTO) private readonly gateway: GatewayPagamento,
    configService: ConfigService,
  ) {
    this.modo = lerModoExpiracao(configService.get('EXPIRACAO_INSCRICOES'));
  }

  onModuleInit() {
    this.logger.log(`Expiração de inscrições não pagas: ${this.modo}.`);
    if (this.modo === 'desligado') return;
    this.inicio = setTimeout(() => void this.executar(), 30_000);
    // A simulacao so lista: roda uma vez por inicializacao.
    if (this.modo === 'ativo') {
      this.timer = setInterval(() => void this.executar(), INTERVALO_MS);
    }
  }

  onModuleDestroy() {
    clearTimeout(this.inicio);
    clearInterval(this.timer);
  }

  async executar() {
    if (this.rodando || this.modo === 'desligado') return;
    this.rodando = true;
    try {
      if (this.modo === 'ativo') {
        await this.reconciliarCartoes();
        await this.enviarLembretes();
      }
      await this.expirarVencidas();
    } catch (err) {
      this.logger.error(`Falha na rotina de expiração: ${err}`);
    } finally {
      this.rodando = false;
    }
  }

  /** Cartao em analise so confirmava por webhook; se ele falhasse, nunca mais. */
  private async reconciliarCartoes() {
    const pendentes = await this.prisma.pagamento.findMany({
      where: {
        metodo: MetodoPagamento.CARTAO_CREDITO,
        status: StatusPagamento.PENDENTE,
        gateway: this.gateway.nome,
        gatewayPaymentId: { not: null },
        createdAt: { gte: new Date(Date.now() - 7 * 24 * HORA_MS) },
      },
      select: { gatewayPaymentId: true },
    });
    for (const p of pendentes) {
      try {
        await this.pagamentoService.sincronizarComGateway(
          p.gatewayPaymentId!,
          'reconciliacao',
        );
      } catch (err) {
        this.logger.error(`Falha ao reconciliar ${p.gatewayPaymentId}: ${err}`);
      }
    }
  }

  buscarInscricoes(dataInscricao: { gte?: Date; lt?: Date }) {
    return this.prisma.inscricao.findMany({
      where: {
        status: StatusInscricao.PENDENTE_PAGAMENTO,
        importacaoId: null,
        dataInscricao,
      },
      include: INCLUDE,
      orderBy: { dataInscricao: 'asc' },
    });
  }

  /** O pedido e pago inteiro, entao tambem expira inteiro. */
  private async buscarGrupos(dataInscricao: { gte?: Date; lt?: Date }) {
    const grupos = new Map<string, Grupo>();
    for (const i of await this.buscarInscricoes(dataInscricao)) {
      const chave = i.pedidoId ?? i.id;
      grupos.set(chave, [...(grupos.get(chave) ?? []), i]);
    }
    return grupos;
  }

  private async expirarVencidas() {
    const grupos = await this.buscarGrupos({
      lt: new Date(Date.now() - HORAS_PRAZO_PAGAMENTO * HORA_MS),
    });
    const total = { NAO_PAGO: 0, PAGO: 0, AGUARDAR: 0 };

    for (const [chave, grupo] of grupos) {
      if ((this.proximaTentativa.get(chave) ?? 0) > Date.now()) continue;
      // Sem decisao (ou com erro) nao insiste a cada ciclo.
      this.proximaTentativa.set(chave, Date.now() + HORA_MS);

      try {
        const situacao = await this.verificar(grupo);
        total[situacao.tipo] += grupo.length;

        const nome =
          grupo[0].atletaNome || grupo[0].cliente.pf?.nomeCompleto || 'Atleta';
        const quem = `${nome} (${grupo.length} inscrição(ões), ${grupo[0].categoria.modalidade.evento.nome}, pedido ${chave})`;

        if (this.modo === 'simulacao') {
          const acao =
            situacao.tipo === 'PAGO'
              ? `JÁ PAGOU (${situacao.pagamento.gatewayPaymentId}), seria CONFIRMADA`
              : situacao.tipo === 'AGUARDAR'
                ? `seria MANTIDA: ${situacao.motivo}`
                : 'seria EXPIRADA';
          this.logger.log(`[SIMULAÇÃO] ${quem}: ${acao}`);
          continue;
        }

        if (situacao.tipo === 'AGUARDAR') {
          this.logger.warn(`${quem} não expirada: ${situacao.motivo}`);
        } else if (situacao.tipo === 'PAGO') {
          await this.confirmar(situacao.pagamento);
        } else {
          await this.expirar(chave, grupo.map((i) => i.id));
          this.proximaTentativa.delete(chave);
        }
      } catch (err) {
        // Um pedido com problema nao pode travar os outros.
        this.logger.error(`Falha ao avaliar o pedido ${chave}: ${err}`);
      }
    }

    if (this.modo === 'simulacao') {
      this.logger.log(
        `[SIMULAÇÃO] Total: ${total.NAO_PAGO} expiraria(m), ${total.PAGO} já paga(s), ${total.AGUARDAR} mantida(s). Nada foi alterado.`,
      );
    }
  }

  private async expirar(chave: string, ids: string[]) {
    // Confere o status no proprio update: pode ter sido paga neste instante.
    const { count } = await this.prisma.inscricao.updateMany({
      where: { id: { in: ids }, status: StatusInscricao.PENDENTE_PAGAMENTO },
      data: { status: StatusInscricao.EXPIRADA },
    });
    if (count === 0) return;
    this.auditLogService.log({
      categoria: CategoriaAuditLog.OPERACIONAL,
      nivel: NivelAuditLog.INFO,
      mensagem: `${count} inscrição(ões) expirada(s) por falta de pagamento`,
      detalhes: { grupo: chave, inscricoes: ids },
    });
  }

  private confirmar(p: PagamentoAprovado) {
    return this.pagamentoService.confirmarPagamento({
      gatewayPaymentId: p.gatewayPaymentId,
      referenciaExterna: p.referenciaExterna,
      valorPago: p.valor,
      valorLiquido: p.valorLiquido,
      metodo: p.metodo,
      origem: 'reconciliacao',
    });
  }

  /**
   * @param ignorarPixAberto para o lembrete: PIX em aberto e o caso normal de
   *   quem ainda nao pagou, nao motivo para esperar.
   */
  private async verificar(
    grupo: Grupo,
    ignorarPixAberto = false,
  ): Promise<Situacao> {
    const agora = new Date();
    const pagamentos = [
      ...grupo.flatMap((i) => i.pagamentos),
      ...(grupo[0].pedido?.pagamentos ?? []),
    ];

    if (pagamentos.some((p) => p.status === StatusPagamento.APROVADO)) {
      return {
        tipo: 'AGUARDAR',
        motivo: 'tem pagamento aprovado no sistema; conferir',
      };
    }
    if (
      !ignorarPixAberto &&
      pagamentos.some(
        (p) =>
          p.status === StatusPagamento.PENDENTE &&
          p.expiraEm &&
          p.expiraEm > agora,
      )
    ) {
      return { tipo: 'AGUARDAR', motivo: 'PIX ainda válido' };
    }

    const { organizadorId } = grupo[0].categoria.modalidade.evento;
    const tokenOrganizador = organizadorId
      ? await this.mpOAuthService.obterTokenValido(organizadorId)
      : null;
    // null = conta da plataforma (cobranca so da taxa do site).
    const tokens = tokenOrganizador ? [tokenOrganizador, null] : [null];
    const referencias = grupo.map((i) => i.id);
    if (grupo[0].pedidoId) referencias.unshift(grupo[0].pedidoId);

    const vistos = new Set<string>();
    let emAndamento = false;
    let semResposta = false;

    for (const referencia of referencias) {
      for (const token of tokens) {
        const achados = await this.gateway.buscarPorReferencia(referencia, token);
        if (achados === null) {
          semResposta = true;
          continue;
        }
        for (const a of achados) {
          vistos.add(a.gatewayPaymentId);
          if (a.status === 'APROVADO') {
            return {
              tipo: 'PAGO',
              pagamento: {
                gatewayPaymentId: a.gatewayPaymentId,
                referenciaExterna: referencia,
                valor: a.valor,
                valorLiquido: a.valorLiquido,
                metodo: a.ehPix
                  ? MetodoPagamento.PIX
                  : MetodoPagamento.CARTAO_CREDITO,
              },
            };
          }
          if (a.status !== 'PENDENTE') continue;
          const pixVencido = a.ehPix && a.expiraEm && a.expiraEm <= agora;
          if (!pixVencido && !(a.ehPix && ignorarPixAberto)) emAndamento = true;
        }
      }
    }

    // Cobrancas que a busca nao devolveu (organizador desconectou a conta, por exemplo).
    for (const p of pagamentos) {
      if (
        p.gateway !== this.gateway.nome ||
        !p.gatewayPaymentId ||
        vistos.has(p.gatewayPaymentId)
      ) {
        continue;
      }
      const remoto = await this.gateway.consultarCobranca(
        p.gatewayPaymentId,
        tokenOrganizador,
      );
      if (!remoto) {
        semResposta = true;
      } else if (remoto.status === 'APROVADO') {
        return {
          tipo: 'PAGO',
          pagamento: {
            gatewayPaymentId: p.gatewayPaymentId,
            referenciaExterna: (p.pedidoId ?? p.inscricaoId)!,
            valor: remoto.valor,
            valorLiquido: remoto.valorLiquido,
            metodo: p.metodo,
          },
        };
      } else if (
        remoto.status === 'PENDENTE' &&
        p.metodo !== MetodoPagamento.PIX
      ) {
        emAndamento = true;
      }
    }

    if (emAndamento) {
      return { tipo: 'AGUARDAR', motivo: 'pagamento em andamento no Mercado Pago' };
    }
    if (semResposta) {
      return { tipo: 'AGUARDAR', motivo: 'Mercado Pago não respondeu à consulta' };
    }
    return { tipo: 'NAO_PAGO' };
  }

  /** Um lembrete por pedido, e nunca para quem ja pagou. */
  private async enviarLembretes() {
    const agora = Date.now();
    const grupos = await this.buscarGrupos({
      gte: new Date(agora - (HORAS_PRAZO_PAGAMENTO - 1) * HORA_MS),
      lt: new Date(agora - HORAS_ATE_LEMBRETE * HORA_MS),
    });

    for (const [chave, grupo] of grupos) {
      try {
        const primeira = grupo[0];
        const evento = primeira.categoria.modalidade.evento;
        if (
          evento.status !== StatusEvento.PUBLICADO ||
          evento.dataInicio < new Date()
        ) {
          continue;
        }

        const mensagem = `${MARCA_LEMBRETE}${chave}`;
        const jaEnviado = await this.prisma.auditLog.findFirst({
          where: { mensagem, createdAt: { gte: new Date(agora - 48 * HORA_MS) } },
          select: { id: true },
        });
        if (jaEnviado || (await this.todosJaConfirmados(grupo, evento.id))) continue;

        // Consulta antes do e-mail: cobrar de quem ja pagou seria pior que nao avisar.
        const situacao = await this.verificar(grupo, true);
        if (situacao.tipo === 'PAGO') {
          await this.confirmar(situacao.pagamento);
          continue;
        }
        if (situacao.tipo === 'AGUARDAR') continue;

        // Marca antes de enviar: falhar no meio nao pode repetir o e-mail.
        await this.prisma.auditLog.create({
          data: {
            categoria: CategoriaAuditLog.OPERACIONAL,
            nivel: NivelAuditLog.INFO,
            mensagem,
            detalhes: { inscricoes: grupo.map((i) => i.id) },
          },
        });
        const nomeComprador =
          primeira.cliente.pf?.nomeCompleto ||
          primeira.cliente.pj?.razaoSocial ||
          'Atleta';
        await this.emailService.enviarLembretePagamento({
          email: primeira.cliente.usuario.email,
          nome: nomeComprador,
          nomeEvento: evento.nome,
          atletas: grupo.map((i) => i.atletaNome || nomeComprador),
          prazo: prazoPagamento(primeira.dataInscricao),
        });
      } catch (err) {
        this.logger.error(`Falha no lembrete do pedido ${chave}: ${err}`);
      }
    }
  }

  /** Tentativa abandonada de quem ja concluiu a compra em outro pedido. */
  private async todosJaConfirmados(grupo: Grupo, eventoId: string) {
    const cpfs = grupo.map((i) => i.atletaCpf);
    const validos = cpfs.filter((c): c is string => !!c);
    if (validos.length !== cpfs.length) return false;

    const confirmadas = await this.prisma.inscricao.findMany({
      where: {
        status: StatusInscricao.CONFIRMADA,
        atletaCpf: { in: validos },
        categoria: { modalidade: { eventoId } },
      },
      select: { atletaCpf: true },
    });
    const confirmados = new Set(confirmadas.map((c) => c.atletaCpf));
    return validos.every((c) => confirmados.has(c));
  }
}
