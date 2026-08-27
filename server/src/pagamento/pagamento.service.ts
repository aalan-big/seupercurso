import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
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
import { CategoriaAuditLog, NivelAuditLog } from '../generated/prisma/enums';

@Injectable()
export class PagamentoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly asaasService: AsaasService,
    private readonly emailService: EmailService,
    private readonly auditLogService: AuditLogService,
    private readonly notificacaoAdminService: NotificacaoAdminService,
  ) {}

  async create(usuarioId: string, dto: CreatePagamentoDto) {
    const clienteId = await this.getClienteIdOuFalhar(usuarioId);

    if (!dto.inscricaoId && !dto.pedidoId) {
      throw new BadRequestException('Informe a inscrição ou o pedido para pagamento.');
    }

    const inscricoes = await this.prisma.inscricao.findMany({
      where: dto.pedidoId
        ? { pedidoId: dto.pedidoId, clienteId }
        : { id: dto.inscricaoId, clienteId },
      include: {
        cliente: { include: { pf: true, pj: true, usuario: true } },
        dependente: true,
        categoria: {
          include: {
            modalidade: {
              include: {
                evento: {
                  include: { organizador: true },
                },
              },
            },
          },
        },
      },
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

    // Se já existe uma tentativa de pagamento pendente para esta inscrição/pedido com este método, reaproveita
    const pagamentoExistente = await this.prisma.pagamento.findFirst({
      where: dto.pedidoId
        ? { pedidoId: dto.pedidoId, metodo: dto.metodo, status: StatusPagamento.PENDENTE }
        : { inscricaoId: dto.inscricaoId, metodo: dto.metodo, status: StatusPagamento.PENDENTE },
      orderBy: { createdAt: 'desc' },
    });

    if (pagamentoExistente && (pagamentoExistente.pixCopiaECola || pagamentoExistente.pixQrCodeUrl)) {
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

    const primeiraInscricao = inscricoes[0];
    const evento = primeiraInscricao.categoria.modalidade.evento;
    const organizadorWalletId = evento.organizador?.asaasWalletId;
    const comissaoPercentual = Number(evento.organizador?.comissaoPercentual ?? 10);
    const comissaoPlataforma = valorBaseTotal * (comissaoPercentual / 100);

    let valorCobrado = valorBaseTotal;

    if (dto.metodo === MetodoPagamento.CARTAO_CREDITO) {
      const parcelas = Math.max(1, dto.parcelas || 1);
      const percentualJurosAsaas = parcelas * 0.0299;
      const taxaFixaCartao = 0.49;
      valorCobrado = Number(((valorBaseTotal + taxaFixaCartao) * (1 + percentualJurosAsaas)).toFixed(2));
    }

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
        comissaoPlataforma,
      });
    } else if (dto.metodo === MetodoPagamento.CARTAO_CREDITO) {
      asaasRes = await this.asaasService.processarPagamentoCartao({
        inscricaoId: refId,
        valorTotal: valorCobrado,
        cliente: { nome: nomeCliente, cpfCnpj: cpfCnpjCliente, email: emailCliente },
        cartao: {
          holderName: dto.cartaoHolderName || nomeCliente,
          number: dto.cartaoNumero?.replace(/\D/g, '') || '4444555566667777',
          expiryMonth: dto.cartaoMesValidade || '12',
          expiryYear: dto.cartaoAnoValidade || '2030',
          ccv: dto.cartaoCcv || '123',
          cpfTitular: dto.cpfTitular || cpfCnpjCliente,
          cep: dto.cep || (clienteComprador as any).endereco?.cep || '60000000',
          numeroResidencia: dto.numeroResidencia || (clienteComprador as any).endereco?.numero || '100',
        },
        parcelas: dto.parcelas || 1,
        organizadorWalletId,
        comissaoPlataforma,
      });
    }

    const isAprovado = asaasRes.status === 'APROVADO';

    const [pagamentoCriado] = await this.prisma.$transaction([
      this.prisma.pagamento.create({
        data: {
          inscricaoId: dto.inscricaoId || null,
          pedidoId: dto.pedidoId || null,
          valor: valorCobrado,
          metodo: dto.metodo,
          status: isAprovado ? StatusPagamento.APROVADO : StatusPagamento.PENDENTE,
          gateway: 'asaas',
          codigoTransacao: asaasRes.asaasPaymentId,
          asaasPaymentId: asaasRes.asaasPaymentId,
          pixCopiaECola: asaasRes.pixCopiaECola || null,
          pixQrCodeUrl: asaasRes.pixQrCodeUrl || null,
          dataPagamento: isAprovado ? new Date() : null,
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

    return pagamentoCriado;
  }

  async simularAprovacao(usuarioId: string, pagamentoId: string) {
    const pagamento = await this.buscarPagamentoDoClienteOuFalhar(
      usuarioId,
      pagamentoId,
    );

    await this.prisma.$transaction([
      this.prisma.pagamento.update({
        where: { id: pagamento.id },
        data: { status: StatusPagamento.APROVADO, dataPagamento: new Date() },
      }),
      this.prisma.inscricao.updateMany({
        where: pagamento.pedidoId
          ? { pedidoId: pagamento.pedidoId }
          : { id: pagamento.inscricaoId! },
        data: { status: StatusInscricao.CONFIRMADA },
      }),
    ]);

    const inscricoesAtualizadas = await this.prisma.inscricao.findMany({
      where: pagamento.pedidoId
        ? { pedidoId: pagamento.pedidoId }
        : { id: pagamento.inscricaoId! },
      include: {
        cliente: { include: { pf: true, pj: true, usuario: true } },
        dependente: true,
        categoria: {
          include: {
            modalidade: {
              include: { evento: true },
            },
          },
        },
      },
    });

    if (inscricoesAtualizadas.length > 0) {
      const primeiraInscricao = inscricoesAtualizadas[0];
      const evento = primeiraInscricao.categoria.modalidade.evento;
      const comprador = primeiraInscricao.cliente;
      const nomeComprador = comprador.pf?.nomeCompleto || comprador.pj?.razaoSocial || comprador.usuario.email;

      const atletasVouchers = inscricoesAtualizadas.map((insc) => ({
        inscricaoId: insc.id,
        nomeAtleta: insc.dependente?.nomeCompleto || insc.atletaNome || comprador.pf?.nomeCompleto || 'Atleta Esportivo',
        cpfAtleta: insc.dependente?.cpf || insc.atletaCpf || comprador.pf?.cpf || null,
        modalidade: insc.categoria.modalidade.nome,
        categoria: insc.categoria.nome,
        tamanhoCamisa: insc.tamanhoCamisa || 'N/A',
        numeroPeito: insc.numeroPeito,
        valor: Number(pagamento.valor).toFixed(2),
      }));

      await this.emailService.enviarConfirmacaoInscricaoBatch({
        emailComprador: comprador.usuario.email,
        nomeComprador,
        nomeEvento: evento.nome,
        dataEvento: new Date(evento.dataInicio).toLocaleDateString('pt-BR'),
        localEvento: evento.local,
        cidadeEstado: `${evento.cidade}/${evento.estado}`,
        valorTotal: Number(pagamento.valor).toFixed(2),
        atletas: atletasVouchers,
      });

      // Disparar notificação em tempo real da comissão para o Painel Admin (Web Push)
      const valorTotalNum = Number(pagamento.valor);
      const comissaoPlataforma = valorTotalNum * 0.10;
      this.notificacaoAdminService.notificarComissao(comissaoPlataforma, valorTotalNum);
    }

    return this.prisma.pagamento.findUnique({ where: { id: pagamento.id } });
  }

  async simularRecusa(usuarioId: string, pagamentoId: string) {
    const pagamento = await this.buscarPagamentoDoClienteOuFalhar(
      usuarioId,
      pagamentoId,
    );

    return this.prisma.pagamento.update({
      where: { id: pagamento.id },
      data: { status: StatusPagamento.RECUSADO },
    });
  }

  private async buscarPagamentoDoClienteOuFalhar(
    usuarioId: string,
    pagamentoId: string,
  ) {
    const clienteId = await this.getClienteIdOuFalhar(usuarioId);

    const pagamento = await this.prisma.pagamento.findUnique({
      where: { id: pagamentoId },
      include: { inscricao: true, pedido: true },
    });
    if (!pagamento) {
      throw new NotFoundException('Pagamento não encontrado.');
    }

    const donoDoPagamento =
      (pagamento.inscricao && pagamento.inscricao.clienteId === clienteId) ||
      (pagamento.pedido && pagamento.pedido.clienteId === clienteId);

    if (!donoDoPagamento) {
      throw new ForbiddenException('Este pagamento não pertence a você.');
    }
    if (pagamento.status !== StatusPagamento.PENDENTE) {
      throw new BadRequestException('Este pagamento já foi processado.');
    }

    return pagamento;
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
