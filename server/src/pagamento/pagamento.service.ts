import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  StatusInscricao,
  StatusPagamento,
  MetodoPagamento,
  CategoriaAuditLog,
  NivelAuditLog,
} from '../generated/prisma/enums';
import { calcularValorInscricao } from '../common/calcular-valor-inscricao';
import { CreatePagamentoDto } from './dto/create-pagamento.dto';
import { EmailService } from '../email/email.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { NotificacaoAdminService } from '../admin/notificacao-admin.service';
import { TarifaService } from './tarifa.service';
import { GATEWAY_PAGAMENTO, type GatewayPagamento } from './gateway.port';
import { MercadoPagoOAuthService } from './mercadopago/mercadopago-oauth.service';

/** Cobranças PIX vencem em 24h. */
const HORAS_VALIDADE_PIX = 24;

/** Tolerância (em reais) na conferência do valor pago vs. valor cobrado. */
const TOLERANCIA_VALOR = 0.05;

const INSCRICAO_COMPLETA_INCLUDE = {
  cliente: { include: { pf: true, pj: true, usuario: true } },
  dependente: true,
  categoria: {
    include: {
      modalidade: {
        include: { evento: { include: { organizador: true } } },
      },
    },
  },
} as const;

@Injectable()
export class PagamentoService {
  private readonly logger = new Logger(PagamentoService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(GATEWAY_PAGAMENTO) private readonly gateway: GatewayPagamento,
    private readonly emailService: EmailService,
    private readonly auditLogService: AuditLogService,
    private readonly notificacaoAdminService: NotificacaoAdminService,
    private readonly tarifaService: TarifaService,
    private readonly mpOAuthService: MercadoPagoOAuthService,
  ) {}

  async create(usuarioId: string, dto: CreatePagamentoDto, remoteIp?: string) {
    const clienteId = await this.getClienteIdOuFalhar(usuarioId);

    if (!dto.inscricaoId && !dto.pedidoId) {
      throw new BadRequestException('Informe a inscrição ou o pedido para pagamento.');
    }

    const inscricoes = await this.prisma.inscricao.findMany({
      where: dto.pedidoId
        ? { pedidoId: dto.pedidoId, clienteId }
        : { id: dto.inscricaoId, clienteId },
      include: INSCRICAO_COMPLETA_INCLUDE,
    });

    if (inscricoes.length === 0) {
      throw new NotFoundException('Inscrição ou pedido não encontrado.');
    }

    if (inscricoes.every((i) => i.status === StatusInscricao.CONFIRMADA)) {
      throw new ConflictException('As inscrições deste pedido já estão confirmadas.');
    }

    const primeiraInscricao = inscricoes[0];
    const evento = primeiraInscricao.categoria.modalidade.evento;

    this.validarMetodoAceitoPeloEvento(evento, dto.metodo);

    // Reaproveita um PIX pendente ainda válido em vez de gerar outro QR Code.
    const pagamentoExistente = await this.prisma.pagamento.findFirst({
      where: dto.pedidoId
        ? { pedidoId: dto.pedidoId, metodo: dto.metodo, status: StatusPagamento.PENDENTE }
        : { inscricaoId: dto.inscricaoId, metodo: dto.metodo, status: StatusPagamento.PENDENTE },
      orderBy: { createdAt: 'desc' },
    });

    const aindaValido =
      !pagamentoExistente?.expiraEm || pagamentoExistente.expiraEm > new Date();

    if (
      pagamentoExistente &&
      aindaValido &&
      // Cobrança de outro gateway nunca é reaproveitada: o código já não vale.
      pagamentoExistente.gateway === this.gateway.nome &&
      (pagamentoExistente.pixCopiaECola || pagamentoExistente.pixQrCodeUrl)
    ) {
      return pagamentoExistente;
    }

    let valorBaseTotal = 0;
    for (const inscricao of inscricoes) {
      valorBaseTotal += await calcularValorInscricao(this.prisma, {
        loteId: inscricao.loteId,
        modalidadeId: inscricao.categoria.modalidadeId,
        clienteId: inscricao.clienteId,
        eventoId: inscricao.categoria.modalidade.eventoId,
        cupomId: inscricao.cupomId,
        dataNascimentoAtleta:
          inscricao.atletaDataNascimento ||
          inscricao.dependente?.dataNascimento ||
          inscricao.cliente.pf?.dataNascimento,
      });
    }

    const comissaoPercentual = Number(evento.organizador?.comissaoPercentual ?? 10);
    const comissaoPlataforma = Number(
      (valorBaseTotal * (comissaoPercentual / 100)).toFixed(2),
    );

    // Token do organizador: a cobrança roda na conta dele e nós ficamos apenas
    // com a comissão. Sem conexão a venda não pode acontecer — o dinheiro
    // cairia inteiro na nossa conta e viraria repasse manual.
    const tokenRecebedor = evento.organizadorId
      ? await this.mpOAuthService.obterTokenValido(evento.organizadorId)
      : null;

    if (evento.organizadorId && !tokenRecebedor) {
      throw new BadRequestException(
        'O organizador deste evento ainda não conectou a conta de recebimento. As inscrições serão liberadas assim que ele concluir.',
      );
    }

    // Quando a propria plataforma organiza o evento, a conta que recebe e a
    // nossa: o Mercado Pago recusa a comissao ("You cannot use application_fee
    // with this payment") e a venda inteira falha. Nao ha o que reter, porque o
    // dinheiro ja cai todo aqui. O valor cobrado do atleta nao muda.
    const recebedorEhAPropriaPlataforma = evento.organizadorId
      ? await this.mpOAuthService.recebedorEhAPropriaPlataforma(
          evento.organizadorId,
        )
      : false;

    const comissaoRetida = recebedorEhAPropriaPlataforma ? 0 : comissaoPlataforma;

    const parcelas = Math.max(1, dto.parcelas || 1);

    // Quem paga a comissão é escolha do organizador, por evento. Absorvendo,
    // ela sai do repasse dele; repassando, vira taxa de serviço somada ao valor
    // do atleta e o organizador recebe o preço cheio da inscrição.
    const valorAntesDaTarifa = evento.comissaoPagaPeloAtleta
      ? Number((valorBaseTotal + comissaoPlataforma).toFixed(2))
      : valorBaseTotal;

    // A tarifa do gateway é sempre do atleta, nos dois casos: o gross-up faz
    // sobrar exatamente o valor a dividir entre organizador e plataforma.
    const valorCobrado = this.tarifaService.calcularValorCobrado(
      valorAntesDaTarifa,
      dto.metodo,
      parcelas,
    );

    const comprador = primeiraInscricao.cliente;
    const cliente = {
      nome:
        comprador.pf?.nomeCompleto || comprador.pj?.razaoSocial || 'Atleta Esportivo',
      cpfCnpj: comprador.pf?.cpf || comprador.pj?.cnpj || '',
      email: comprador.usuario.email,
      telefone: comprador.pf?.celular || comprador.pj?.celularComercial || null,
    };

    const referenciaExterna = dto.pedidoId ?? primeiraInscricao.id;
    const descricao = `Inscrição — ${evento.nome}`.slice(0, 250);

    const expiraEm =
      dto.metodo === MetodoPagamento.PIX
        ? new Date(Date.now() + HORAS_VALIDADE_PIX * 60 * 60 * 1000)
        : null;

    const resultado =
      dto.metodo === MetodoPagamento.PIX
        ? await this.gateway.gerarCobrancaPix({
            referenciaExterna,
            valor: valorCobrado,
            descricao,
            cliente,
            tokenRecebedor,
            comissaoPlataforma: comissaoRetida,
            expiraEm: expiraEm ?? undefined,
          })
        : await this.gateway.processarPagamentoCartao({
            referenciaExterna,
            valor: valorCobrado,
            descricao,
            cliente,
            tokenCartao: dto.tokenCartao!,
            parcelas,
            metodoBandeira: dto.metodoBandeira,
            emissor: dto.emissor,
            tokenRecebedor,
            comissaoPlataforma: comissaoRetida,
            remoteIp,
          });

    const isAprovado = resultado.status === 'APROVADO';

    const dadosPagamento = {
      valor: valorCobrado,
      metodo: dto.metodo,
      status: isAprovado ? StatusPagamento.APROVADO : StatusPagamento.PENDENTE,
      gateway: this.gateway.nome,
      codigoTransacao: resultado.gatewayPaymentId,
      gatewayPaymentId: resultado.gatewayPaymentId,
      pixCopiaECola: resultado.pixCopiaECola || null,
      pixQrCodeUrl: resultado.pixQrCodeUrl || null,
      dataPagamento: isAprovado ? new Date() : null,
      expiraEm,
    };

    const [pagamentoCriado] = await this.prisma.$transaction([
      pagamentoExistente
        ? this.prisma.pagamento.update({
            where: { id: pagamentoExistente.id },
            data: dadosPagamento,
          })
        : this.prisma.pagamento.create({
            data: {
              inscricaoId: dto.inscricaoId || null,
              pedidoId: dto.pedidoId || null,
              ...dadosPagamento,
            },
          }),
      ...(isAprovado
        ? [
            this.prisma.inscricao.updateMany({
              where: dto.pedidoId ? { pedidoId: dto.pedidoId } : { id: dto.inscricaoId },
              data: { status: StatusInscricao.CONFIRMADA },
            }),
          ]
        : []),
    ]);

    this.auditLogService.log({
      categoria: CategoriaAuditLog.FINANCEIRO,
      nivel: NivelAuditLog.INFO,
      mensagem: `Cobrança ${dto.metodo} de R$ ${valorCobrado.toFixed(2)} gerada (${inscricoes.length} inscrição(ões))`,
      detalhes: {
        pagamentoId: pagamentoCriado.id,
        pedidoId: dto.pedidoId,
        inscricaoId: dto.inscricaoId,
        metodo: dto.metodo,
        valorBase: valorBaseTotal,
        valorCobrado,
        comissaoPlataforma,
        comissaoPagaPeloAtleta: evento.comissaoPagaPeloAtleta,
        gateway: this.gateway.nome,
      },
      usuarioId,
    });

    if (isAprovado) {
      await this.notificarConfirmacao(pagamentoCriado.id);
    }

    return pagamentoCriado;
  }

  /**
   * Status da cobrança para o comprador, reconciliando com o gateway enquanto
   * estiver pendente — o webhook pode atrasar ou falhar, e sem isso quem já
   * pagou ficaria preso na tela.
   */
  async obterStatus(usuarioId: string, pagamentoId: string) {
    const clienteId = await this.getClienteIdOuFalhar(usuarioId);

    const pagamento = await this.prisma.pagamento.findUnique({
      where: { id: pagamentoId },
      include: { inscricao: true, pedido: true },
    });

    if (!pagamento) {
      throw new NotFoundException('Pagamento não encontrado.');
    }

    const dono =
      pagamento.inscricao?.clienteId === clienteId ||
      pagamento.pedido?.clienteId === clienteId;

    if (!dono) {
      throw new ForbiddenException('Este pagamento não pertence a você.');
    }

    if (pagamento.status === StatusPagamento.PENDENTE && pagamento.gatewayPaymentId) {
      await this.sincronizarComGateway(pagamento.gatewayPaymentId, 'reconciliacao');
    }

    return this.prisma.pagamento.findUnique({
      where: { id: pagamento.id },
      select: {
        id: true,
        status: true,
        metodo: true,
        valor: true,
        expiraEm: true,
        dataPagamento: true,
        pixCopiaECola: true,
        pixQrCodeUrl: true,
      },
    });
  }

  /**
   * Alinha o pagamento local ao que o gateway diz.
   *
   * O webhook do Mercado Pago traz só o id, então quem decide o status é sempre
   * a consulta à API — nunca o corpo de um POST, que poderia ser forjado.
   */
  async sincronizarComGateway(
    gatewayPaymentId: string,
    origem: 'webhook' | 'reconciliacao',
  ) {
    const remoto = await this.gateway.consultarCobranca(gatewayPaymentId);

    if (!remoto) {
      this.logger.warn(
        `Não foi possível consultar o pagamento ${gatewayPaymentId} no gateway (${origem}).`,
      );
      return { ignorado: true };
    }

    if (remoto.status === 'APROVADO') {
      return this.confirmarPagamento({
        gatewayPaymentId,
        referenciaExterna: remoto.referenciaExterna,
        valorPago: remoto.valor,
        valorLiquido: remoto.valorLiquido,
        origem,
      });
    }

    if (remoto.status === 'ESTORNADO' || remoto.status === 'CANCELADO') {
      await this.registrarEstorno(gatewayPaymentId, remoto.status);
      return { estornado: true };
    }

    // Segue pendente: só expira depois da validade do PIX.
    await this.prisma.pagamento.updateMany({
      where: {
        gatewayPaymentId,
        status: StatusPagamento.PENDENTE,
        expiraEm: { lt: new Date() },
      },
      data: { status: StatusPagamento.EXPIRADO },
    });

    return { pendente: true };
  }

  /**
   * Confirma a cobrança: marca o pagamento, confirma as inscrições e dispara os
   * vouchers. Idempotente — reenvios do gateway não reprocessam nem reenviam
   * e-mails.
   */
  async confirmarPagamento(params: {
    gatewayPaymentId: string;
    referenciaExterna?: string | null;
    valorPago?: number;
    valorLiquido?: number | null;
    origem: 'webhook' | 'reconciliacao';
  }) {
    const { gatewayPaymentId, referenciaExterna, valorPago, valorLiquido, origem } =
      params;

    const pagamentoExistente = await this.prisma.pagamento.findFirst({
      where: {
        OR: [
          { gatewayPaymentId },
          ...(referenciaExterna
            ? [{ pedidoId: referenciaExterna }, { inscricaoId: referenciaExterna }]
            : []),
        ],
      },
    });

    if (pagamentoExistente?.status === StatusPagamento.APROVADO) {
      this.logger.log(
        `Pagamento ${pagamentoExistente.id} já aprovado; ignorando ${origem} duplicado.`,
      );
      return { jaProcessado: true, pagamentoId: pagamentoExistente.id };
    }

    if (
      pagamentoExistente &&
      typeof valorPago === 'number' &&
      valorPago > 0 &&
      Number(pagamentoExistente.valor) - valorPago > TOLERANCIA_VALOR
    ) {
      this.logger.error(
        `Valor divergente no pagamento ${pagamentoExistente.id}: cobrado R$ ${Number(
          pagamentoExistente.valor,
        ).toFixed(2)}, pago R$ ${valorPago.toFixed(2)}. Confirmação bloqueada.`,
      );
      this.auditLogService.log({
        categoria: CategoriaAuditLog.FINANCEIRO,
        nivel: NivelAuditLog.ERROR,
        mensagem: `Pagamento ${gatewayPaymentId} recebido com valor menor que o cobrado; confirmação bloqueada.`,
        detalhes: {
          pagamentoId: pagamentoExistente.id,
          valorCobrado: Number(pagamentoExistente.valor),
          valorPago,
        },
      });
      return { valorDivergente: true, pagamentoId: pagamentoExistente.id };
    }

    const liquido =
      typeof valorLiquido === 'number' && valorLiquido > 0 ? valorLiquido : null;

    const pedidoId =
      pagamentoExistente?.pedidoId ||
      (referenciaExterna ? await this.descobrirSeEhPedido(referenciaExterna) : null);
    const inscricaoId =
      pagamentoExistente?.inscricaoId || (!pedidoId ? referenciaExterna || null : null);

    if (!pagamentoExistente && !pedidoId && !inscricaoId) {
      this.logger.warn(
        `Pagamento ${gatewayPaymentId} aprovado sem referência local (ref=${referenciaExterna}).`,
      );
      return { ignorado: true };
    }

    const pagamentoId = await this.prisma.$transaction(async (tx) => {
      if (pagamentoExistente) {
        await tx.pagamento.update({
          where: { id: pagamentoExistente.id },
          data: {
            status: StatusPagamento.APROVADO,
            dataPagamento: new Date(),
            gatewayPaymentId,
            ...(liquido
              ? {
                  valorLiquido: liquido,
                  taxaGateway: Number(
                    (Number(pagamentoExistente.valor) - liquido).toFixed(2),
                  ),
                }
              : {}),
          },
        });
      }

      await tx.inscricao.updateMany({
        where: pedidoId ? { pedidoId } : { id: inscricaoId! },
        data: { status: StatusInscricao.CONFIRMADA },
      });

      if (pagamentoExistente) return pagamentoExistente.id;

      // Cobrança aprovada sem registro local: materializa para não sumir do
      // financeiro do organizador e do admin.
      const criado = await tx.pagamento.create({
        data: {
          inscricaoId,
          pedidoId,
          valor: valorPago ?? 0,
          valorLiquido: liquido,
          taxaGateway:
            liquido && valorPago ? Number((valorPago - liquido).toFixed(2)) : null,
          metodo: MetodoPagamento.PIX,
          status: StatusPagamento.APROVADO,
          gateway: this.gateway.nome,
          codigoTransacao: gatewayPaymentId,
          gatewayPaymentId,
          dataPagamento: new Date(),
        },
      });
      return criado.id;
    });

    await this.notificarConfirmacao(pagamentoId);

    return { confirmado: true, pagamentoId };
  }

  async registrarEstorno(
    gatewayPaymentId: string,
    status: 'ESTORNADO' | 'CANCELADO' = 'ESTORNADO',
  ) {
    this.logger.warn(`Pagamento ${gatewayPaymentId} ${status.toLowerCase()}.`);

    await this.prisma.pagamento.updateMany({
      where: { gatewayPaymentId },
      data: {
        status:
          status === 'CANCELADO'
            ? StatusPagamento.CANCELADO
            : StatusPagamento.ESTORNADO,
      },
    });
  }

  /**
   * Envia os vouchers e notifica a comissão no painel admin.
   * Nunca propaga erro: a confirmação do pagamento já foi persistida.
   */
  private async notificarConfirmacao(pagamentoId: string) {
    try {
      const pagamento = await this.prisma.pagamento.findUnique({
        where: { id: pagamentoId },
      });
      if (!pagamento) return;

      const inscricoes = await this.prisma.inscricao.findMany({
        where: pagamento.pedidoId
          ? { pedidoId: pagamento.pedidoId }
          : { id: pagamento.inscricaoId! },
        include: INSCRICAO_COMPLETA_INCLUDE,
      });

      if (inscricoes.length === 0) return;

      const primeira = inscricoes[0];
      const evento = primeira.categoria.modalidade.evento;
      const comprador = primeira.cliente;
      const nomeComprador =
        comprador.pf?.nomeCompleto ||
        comprador.pj?.razaoSocial ||
        comprador.usuario.email;

      const valorTotal = Number(pagamento.valor);

      await this.emailService.enviarConfirmacaoInscricaoBatch({
        emailComprador: comprador.usuario.email,
        nomeComprador,
        nomeEvento: evento.nome,
        dataEvento: new Date(evento.dataInicio).toLocaleDateString('pt-BR'),
        localEvento: evento.local,
        cidadeEstado: `${evento.cidade}/${evento.estado}`,
        valorTotal: valorTotal.toFixed(2),
        atletas: inscricoes.map((insc) => ({
          inscricaoId: insc.id,
          nomeAtleta:
            insc.dependente?.nomeCompleto ||
            insc.atletaNome ||
            comprador.pf?.nomeCompleto ||
            'Atleta Esportivo',
          cpfAtleta: insc.dependente?.cpf || insc.atletaCpf || comprador.pf?.cpf || null,
          modalidade: insc.categoria.modalidade.nome,
          categoria: insc.categoria.nome,
          tamanhoCamisa: insc.tamanhoCamisa || 'N/A',
          numeroPeito: insc.numeroPeito,
          valor: valorTotal.toFixed(2),
        })),
      });

      const comissaoPercentual = Number(evento.organizador?.comissaoPercentual ?? 10);
      const comissaoPlataforma = valorTotal * (comissaoPercentual / 100);
      if (comissaoPlataforma > 0) {
        this.notificacaoAdminService.notificarComissao(comissaoPlataforma, valorTotal);
      }
    } catch (err) {
      this.logger.error(
        `Falha ao notificar confirmação do pagamento ${pagamentoId}: ${err}`,
      );
    }
  }

  private validarMetodoAceitoPeloEvento(
    evento: { aceitaPix: boolean; aceitaCartao: boolean },
    metodo: MetodoPagamento,
  ) {
    if (metodo === MetodoPagamento.PIX && evento.aceitaPix === false) {
      throw new BadRequestException('Este evento não aceita pagamento via PIX.');
    }
    if (metodo === MetodoPagamento.CARTAO_CREDITO && evento.aceitaCartao === false) {
      throw new BadRequestException(
        'Este evento não aceita pagamento com cartão de crédito.',
      );
    }
    if (metodo !== MetodoPagamento.PIX && metodo !== MetodoPagamento.CARTAO_CREDITO) {
      throw new BadRequestException(
        'Método de pagamento não suportado. Utilize PIX ou cartão de crédito.',
      );
    }
  }

  private async descobrirSeEhPedido(refId: string): Promise<string | null> {
    try {
      const pedido = await this.prisma.pedido.findUnique({ where: { id: refId } });
      return pedido ? pedido.id : null;
    } catch {
      return null;
    }
  }

  private async getClienteIdOuFalhar(usuarioId: string): Promise<string> {
    const cliente = await this.prisma.cliente.findUnique({ where: { usuarioId } });
    if (!cliente) {
      throw new NotFoundException(
        'Complete seu perfil (PF ou PJ) antes de pagar uma inscrição.',
      );
    }
    return cliente.id;
  }
}
