import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StatusInscricao, StatusPagamento, MetodoPagamento } from '../generated/prisma/enums';
import { calcularValorInscricao } from '../common/calcular-valor-inscricao';
import { CreatePagamentoDto } from './dto/create-pagamento.dto';
import { AsaasService } from './asaas.service';
import { EmailService } from '../email/email.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { NotificacaoAdminService } from '../admin/notificacao-admin.service';
import { TarifaService } from './tarifa.service';
import { CategoriaAuditLog, NivelAuditLog } from '../generated/prisma/enums';

/** Cobranças PIX do Asaas vencem em 24h; espelhamos isso no nosso registro. */
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
    private readonly asaasService: AsaasService,
    private readonly emailService: EmailService,
    private readonly auditLogService: AuditLogService,
    private readonly notificacaoAdminService: NotificacaoAdminService,
    private readonly tarifaService: TarifaService,
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

    if (!inscricoes || inscricoes.length === 0) {
      throw new NotFoundException('Inscrição ou pedido não encontrado.');
    }

    const todasConfirmadas = inscricoes.every(
      (i) => i.status === StatusInscricao.CONFIRMADA,
    );
    if (todasConfirmadas) {
      throw new ConflictException('As inscrições deste pedido já estão confirmadas.');
    }

    const primeiraInscricao = inscricoes[0];
    const evento = primeiraInscricao.categoria.modalidade.evento;

    this.validarMetodoAceitoPeloEvento(evento, dto.metodo);

    // Se já existe uma tentativa de pagamento pendente para esta inscrição/pedido com este método, reaproveita apenas se for válido e real
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
      (pagamentoExistente.pixCopiaECola || pagamentoExistente.pixQrCodeUrl) &&
      !pagamentoExistente.pixCopiaECola?.includes('sandbox') &&
      !pagamentoExistente.pixCopiaECola?.includes('seupercurso-sandbox') &&
      !pagamentoExistente.asaasPaymentId?.startsWith('pay_mock_') &&
      !pagamentoExistente.asaasPaymentId?.startsWith('pay_pix_mock_')
    ) {
      return pagamentoExistente;
    }

    // Soma os valores reais de cada inscrição
    let valorBaseTotal = 0;
    for (const inscricao of inscricoes) {
      const valorItem = await calcularValorInscricao(this.prisma, {
        loteId: inscricao.loteId,
        modalidadeId: inscricao.categoria.modalidadeId,
        clienteId: inscricao.clienteId,
        eventoId: inscricao.categoria.modalidade.eventoId,
        cupomId: inscricao.cupomId,
        dataNascimentoAtleta: inscricao.atletaDataNascimento || inscricao.dependente?.dataNascimento || inscricao.cliente.pf?.dataNascimento,
      });
      valorBaseTotal += valorItem;
    }

    const organizadorWalletId = evento.organizador?.asaasWalletId;
    const comissaoPercentual = Number(evento.organizador?.comissaoPercentual ?? 10);
    const comissaoPlataforma = Number(
      (valorBaseTotal * (comissaoPercentual / 100)).toFixed(2),
    );

    // O organizador recebe o valor da inscrição menos a comissão. A tarifa do
    // gateway não sai daqui: ela é acrescida ao valor cobrado do atleta.
    const valorLiquidoOrganizador = Number(
      (valorBaseTotal - comissaoPlataforma).toFixed(2),
    );

    // Tarifa do gateway repassada ao atleta, em PIX e em cartão. Com o
    // gross-up, o que sobra depois da tarifa é exatamente o valor da inscrição.
    const parcelas = Math.max(1, dto.parcelas || 1);
    const valorCobrado = this.tarifaService.calcularValorCobrado(
      valorBaseTotal,
      dto.metodo,
      parcelas,
    );


    const clienteComprador = primeiraInscricao.cliente;
    const nomeCliente =
      clienteComprador.pf?.nomeCompleto ||
      clienteComprador.pj?.razaoSocial ||
      'Atleta Esportivo';
    const cpfCnpjCliente =
      clienteComprador.pf?.cpf ||
      clienteComprador.pj?.cnpj ||
      '00000000000';
    const emailCliente = clienteComprador.usuario.email;
    const telefoneCliente =
      clienteComprador.pf?.celular || clienteComprador.pj?.celularComercial || null;

    const refId = dto.pedidoId ? dto.pedidoId : primeiraInscricao.id;

    let asaasRes: { asaasPaymentId: string; pixCopiaECola?: string | null; pixQrCodeUrl?: string | null; status?: string } = {
      asaasPaymentId: `pay_mock_${randomUUID()}`,
    };

    if (dto.metodo === MetodoPagamento.PIX) {
      asaasRes = await this.asaasService.gerarCobrancaPix({
        inscricaoId: refId,
        valor: valorCobrado,
        cliente: { nome: nomeCliente, cpfCnpj: cpfCnpjCliente, email: emailCliente },
        organizadorWalletId,
        valorLiquidoOrganizador,
        valorLiquidoEsperado: valorBaseTotal,
      });
    } else if (dto.metodo === MetodoPagamento.CARTAO_CREDITO) {
      asaasRes = await this.asaasService.processarPagamentoCartao({
        inscricaoId: refId,
        valorTotal: valorCobrado,
        cliente: {
          nome: nomeCliente,
          cpfCnpj: cpfCnpjCliente,
          email: emailCliente,
          telefone: telefoneCliente,
        },
        cartao: {
          holderName: dto.cartaoHolderName!,
          number: dto.cartaoNumero!,
          expiryMonth: dto.cartaoMesValidade!,
          expiryYear: dto.cartaoAnoValidade!,
          ccv: dto.cartaoCcv!,
          cpfTitular: dto.cpfTitular,
          cep: dto.cep,
          numeroResidencia: dto.numeroResidencia,
        },
        parcelas,
        organizadorWalletId,
        valorLiquidoOrganizador,
        valorLiquidoEsperado: valorBaseTotal,
        remoteIp,
      });
    } else {
      throw new BadRequestException(
        'Método de pagamento não suportado. Utilize PIX ou cartão de crédito.',
      );
    }

    const isAprovado = asaasRes.status === 'APROVADO';
    const expiraEm =
      dto.metodo === MetodoPagamento.PIX
        ? new Date(Date.now() + HORAS_VALIDADE_PIX * 60 * 60 * 1000)
        : null;

    const dadosPagamento = {
      valor: valorCobrado,
      metodo: dto.metodo,
      status: isAprovado ? StatusPagamento.APROVADO : StatusPagamento.PENDENTE,
      gateway: 'asaas',
      codigoTransacao: asaasRes.asaasPaymentId,
      asaasPaymentId: asaasRes.asaasPaymentId,
      pixCopiaECola: asaasRes.pixCopiaECola || null,
      pixQrCodeUrl: asaasRes.pixQrCodeUrl || null,
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
      mensagem: `Cobrança ${dto.metodo} gerada no valor de R$ ${valorCobrado.toFixed(2)} (${inscricoes.length} inscrição(ões))`,
      detalhes: {
        pagamentoId: pagamentoCriado.id,
        pedidoId: dto.pedidoId,
        inscricaoId: dto.inscricaoId,
        metodo: dto.metodo,
        valorTotal: valorCobrado,
        comissaoPlataforma,
      },
      usuarioId,
    });

    // Cartão aprovado na hora não gera webhook de confirmação pendente,
    // então os vouchers precisam sair aqui.
    if (isAprovado) {
      await this.notificarConfirmacao(pagamentoCriado.id);
    }

    return pagamentoCriado;
  }

  /**
   * Status de uma cobrança para acompanhamento pelo comprador.
   *
   * Reconcilia com o Asaas quando o pagamento ainda está pendente: o webhook pode
   * falhar ou atrasar, e sem isso o comprador que já pagou o PIX ficava preso na
   * tela sem confirmação.
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

    const donoDoPagamento =
      pagamento.inscricao?.clienteId === clienteId ||
      pagamento.pedido?.clienteId === clienteId;

    if (!donoDoPagamento) {
      throw new ForbiddenException('Este pagamento não pertence a você.');
    }

    if (pagamento.status === StatusPagamento.PENDENTE && pagamento.asaasPaymentId) {
      const remoto = await this.asaasService.consultarPagamento(pagamento.asaasPaymentId);

      if (remoto && (remoto.status === 'RECEIVED' || remoto.status === 'CONFIRMED')) {
        await this.confirmarPagamento({
          asaasPaymentId: pagamento.asaasPaymentId,
          valorPago: remoto.valor,
          valorLiquido: remoto.valorLiquido,
          origem: 'reconciliacao',
        });
      } else if (pagamento.expiraEm && pagamento.expiraEm < new Date()) {
        await this.prisma.pagamento.updateMany({
          where: { id: pagamento.id, status: StatusPagamento.PENDENTE },
          data: { status: StatusPagamento.EXPIRADO },
        });
      }
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
   * Confirma uma cobrança aprovada no gateway: marca o pagamento, confirma as
   * inscrições e dispara os vouchers.
   *
   * É idempotente — reenvios de webhook do Asaas não reprocessam nem reenviam
   * e-mails. Usada pelo webhook e pela reconciliação de status.
   */
  async confirmarPagamento(params: {
    asaasPaymentId: string;
    referenciaExterna?: string | null;
    valorPago?: number;
    /** netValue do Asaas: valor menos a tarifa do gateway. */
    valorLiquido?: number | null;
    origem: 'webhook' | 'reconciliacao';
  }) {
    const { asaasPaymentId, referenciaExterna, valorPago, valorLiquido, origem } =
      params;

    // A tarifa so e conhecida pelo gateway; sem guardar isso o painel mostraria
    // um liquido diferente do saldo que o organizador consegue sacar.
    const liquido =
      typeof valorLiquido === 'number' && valorLiquido > 0 ? valorLiquido : null;

    const pagamentoExistente = await this.prisma.pagamento.findFirst({
      where: {
        OR: [
          { asaasPaymentId },
          ...(referenciaExterna
            ? [{ pedidoId: referenciaExterna }, { inscricaoId: referenciaExterna }]
            : []),
        ],
      },
    });

    // Idempotência: um reenvio do Asaas não deve reprocessar nem reenviar vouchers.
    if (pagamentoExistente?.status === StatusPagamento.APROVADO) {
      this.logger.log(
        `Pagamento ${pagamentoExistente.id} já estava aprovado; ignorando ${origem} duplicado.`,
      );
      return { jaProcessado: true, pagamentoId: pagamentoExistente.id };
    }

    // Confere o valor efetivamente pago contra o valor cobrado.
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
        mensagem: `Pagamento ${asaasPaymentId} recebido com valor menor que o cobrado; confirmação bloqueada.`,
        detalhes: {
          pagamentoId: pagamentoExistente.id,
          valorCobrado: Number(pagamentoExistente.valor),
          valorPago,
        },
      });
      return { valorDivergente: true, pagamentoId: pagamentoExistente.id };
    }

    const pedidoId =
      pagamentoExistente?.pedidoId ||
      (referenciaExterna ? await this.descobrirSeEhPedido(referenciaExterna) : null);
    const inscricaoId =
      pagamentoExistente?.inscricaoId || (!pedidoId ? referenciaExterna || null : null);

    if (!pagamentoExistente && !pedidoId && !inscricaoId) {
      this.logger.warn(
        `Pagamento ${asaasPaymentId} aprovado no Asaas sem referência local (ref=${referenciaExterna}).`,
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
            asaasPaymentId,
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

      // Cobrança aprovada sem registro local (registro perdido ou criada fora do
      // fluxo): materializa o pagamento para que ele apareça no financeiro do
      // organizador e do admin em vez de sumir do relatório.
      const criado = await tx.pagamento.create({
        data: {
          inscricaoId,
          pedidoId,
          valor: valorPago ?? 0,
          valorLiquido: liquido,
          taxaGateway:
            liquido && valorPago
              ? Number((valorPago - liquido).toFixed(2))
              : null,
          metodo: MetodoPagamento.PIX,
          status: StatusPagamento.APROVADO,
          gateway: 'asaas',
          codigoTransacao: asaasPaymentId,
          asaasPaymentId,
          dataPagamento: new Date(),
        },
      });
      return criado.id;
    });

    await this.notificarConfirmacao(pagamentoId);

    return { confirmado: true, pagamentoId };
  }

  /** Marca uma cobrança como estornada/cancelada a partir do webhook. */
  async registrarEstorno(asaasPaymentId: string) {
    await this.prisma.pagamento.updateMany({
      where: { asaasPaymentId },
      data: { status: StatusPagamento.ESTORNADO },
    });
  }

  /**
   * Envia os vouchers ao comprador e notifica a comissão no painel admin.
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
        comprador.pf?.nomeCompleto || comprador.pj?.razaoSocial || comprador.usuario.email;

      const valorTotal = Number(pagamento.valor);

      const atletasVouchers = inscricoes.map((insc) => ({
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
      }));

      await this.emailService.enviarConfirmacaoInscricaoBatch({
        emailComprador: comprador.usuario.email,
        nomeComprador,
        nomeEvento: evento.nome,
        dataEvento: new Date(evento.dataInicio).toLocaleDateString('pt-BR'),
        localEvento: evento.local,
        cidadeEstado: `${evento.cidade}/${evento.estado}`,
        valorTotal: valorTotal.toFixed(2),
        atletas: atletasVouchers,
      });

      // Comissão real do organizador — antes estava fixada em 10%.
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
    const cliente = await this.prisma.cliente.findUnique({
      where: { usuarioId },
    });
    if (!cliente) {
      throw new NotFoundException(
        'Complete seu perfil (PF ou PJ) antes de pagar uma inscrição.',
      );
    }
    return cliente.id;
  }
}
