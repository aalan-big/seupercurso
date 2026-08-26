import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AsaasService } from '../pagamento/asaas.service';
import { StatusSolicitacaoArte } from '../generated/prisma/enums';

const SOLICITACAO_INCLUDE = {
  evento: { select: { id: true, nome: true, bannerUrl: true } },
  organizador: {
    include: {
      cliente: {
        include: {
          usuario: { select: { email: true } },
          pf: true,
          pj: true,
        },
      },
    },
  },
} as const;

@Injectable()
export class ArteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly asaasService: AsaasService,
  ) {}

  async obterPreco() {
    return this.prisma.configuracaoPlataforma.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
    });
  }

  async atualizarPreco(valor: number) {
    return this.prisma.configuracaoPlataforma.upsert({
      where: { id: 'default' },
      update: { precoArteEvento: valor },
      create: { id: 'default', precoArteEvento: valor },
    });
  }

  async solicitar(usuarioId: string, eventoId: string, observacoes?: string) {
    const organizador = await this.getOrganizadorOuFalhar(usuarioId);

    const evento = await this.prisma.evento.findUnique({ where: { id: eventoId } });
    if (!evento || evento.organizadorId !== organizador.id) {
      throw new NotFoundException('Evento não encontrado.');
    }

    const emAndamento = await this.prisma.solicitacaoArte.findFirst({
      where: {
        eventoId,
        status: {
          in: [
            StatusSolicitacaoArte.PENDENTE_PAGAMENTO,
            StatusSolicitacaoArte.PAGO,
            StatusSolicitacaoArte.EM_PRODUCAO,
          ],
        },
      },
    });
    if (emAndamento) {
      throw new ConflictException(
        'Já existe uma solicitação de arte em andamento para esse evento.',
      );
    }

    const config = await this.obterPreco();
    const valor = Number(config.precoArteEvento);

    const nome =
      organizador.cliente.pf?.nomeCompleto || organizador.cliente.pj?.razaoSocial || 'Organizador';
    const cpfCnpj = organizador.cliente.pf?.cpf || organizador.cliente.pj?.cnpj || '';
    const email = organizador.cliente.usuario.email;

    const solicitacao = await this.prisma.solicitacaoArte.create({
      data: {
        eventoId,
        organizadorId: organizador.id,
        valor,
        observacoes: observacoes?.trim() || null,
      },
    });

    const pix = await this.asaasService.gerarCobrancaPix({
      valor,
      cliente: { nome, cpfCnpj, email },
      referenciaExterna: `arte:${solicitacao.id}`,
      descricao: `Arte para o evento ${evento.nome}`,
    });

    return this.prisma.solicitacaoArte.update({
      where: { id: solicitacao.id },
      data: {
        asaasPaymentId: pix.asaasPaymentId,
        pixCopiaECola: pix.pixCopiaECola,
        pixQrCodeUrl: pix.pixQrCodeUrl,
      },
      include: SOLICITACAO_INCLUDE,
    });
  }

  async listarMinhas(usuarioId: string) {
    const organizador = await this.getOrganizadorOuFalhar(usuarioId);

    return this.prisma.solicitacaoArte.findMany({
      where: { organizadorId: organizador.id },
      orderBy: { createdAt: 'desc' },
      include: SOLICITACAO_INCLUDE,
    });
  }

  async listarTodas(status?: string) {
    return this.prisma.solicitacaoArte.findMany({
      where: status ? { status: status as StatusSolicitacaoArte } : undefined,
      orderBy: { createdAt: 'asc' },
      include: SOLICITACAO_INCLUDE,
    });
  }

  async buscar(id: string) {
    const solicitacao = await this.prisma.solicitacaoArte.findUnique({
      where: { id },
      include: SOLICITACAO_INCLUDE,
    });
    if (!solicitacao) {
      throw new NotFoundException('Solicitação de arte não encontrada.');
    }
    return solicitacao;
  }

  async iniciarProducao(id: string) {
    const solicitacao = await this.buscar(id);
    if (solicitacao.status !== StatusSolicitacaoArte.PAGO) {
      throw new BadRequestException(
        'Só é possível iniciar a produção de uma solicitação já paga.',
      );
    }

    return this.prisma.solicitacaoArte.update({
      where: { id },
      data: { status: StatusSolicitacaoArte.EM_PRODUCAO },
      include: SOLICITACAO_INCLUDE,
    });
  }

  async entregar(id: string, arquivoUrl: string) {
    const solicitacao = await this.buscar(id);
    if (
      solicitacao.status !== StatusSolicitacaoArte.EM_PRODUCAO &&
      solicitacao.status !== StatusSolicitacaoArte.PAGO
    ) {
      throw new BadRequestException(
        'Só é possível entregar a arte de uma solicitação paga ou em produção.',
      );
    }

    return this.prisma.solicitacaoArte.update({
      where: { id },
      data: { status: StatusSolicitacaoArte.ENTREGUE, arquivoEntregueUrl: arquivoUrl },
      include: SOLICITACAO_INCLUDE,
    });
  }

  async cancelar(id: string, motivo?: string) {
    await this.buscar(id);

    return this.prisma.solicitacaoArte.update({
      where: { id },
      data: { status: StatusSolicitacaoArte.CANCELADO, motivoCancelamento: motivo ?? null },
      include: SOLICITACAO_INCLUDE,
    });
  }

  private async getOrganizadorOuFalhar(usuarioId: string) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { usuarioId },
      include: {
        organizador: {
          include: {
            cliente: {
              include: {
                usuario: { select: { email: true } },
                pf: true,
                pj: true,
              },
            },
          },
        },
      },
    });

    if (!cliente?.organizador) {
      throw new ForbiddenException('Você ainda não solicitou cadastro como organizador.');
    }

    return cliente.organizador;
  }
}
