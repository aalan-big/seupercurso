import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { NotificacaoAdminService } from '../admin/notificacao-admin.service';
import {
  StatusCotacaoCronometragem,
  StatusEvento,
  StatusInscricao,
  StatusOrganizador,
} from '../generated/prisma/enums';
import { SolicitarCotacaoDto } from './dto/solicitar-cotacao.dto';
import { PropostaCotacaoDto } from './dto/proposta-cotacao.dto';

const S = StatusCotacaoCronometragem;

/** Enquanto houver uma destas, o evento nao abre outra cotacao. */
const STATUS_ABERTOS: StatusCotacaoCronometragem[] = [S.SOLICITADA, S.ORCADA, S.ACEITA, S.PAGA];

const COTACAO_INCLUDE = {
  evento: {
    select: {
      id: true,
      nome: true,
      dataInicio: true,
      dataFim: true,
      local: true,
      cidade: true,
      estado: true,
      status: true,
    },
  },
  cronometradora: { select: { id: true, nome: true } },
} as const;

const COTACAO_ADMIN_INCLUDE = {
  ...COTACAO_INCLUDE,
  organizador: {
    select: {
      id: true,
      cliente: {
        select: {
          usuario: { select: { email: true } },
          pf: { select: { nomeCompleto: true, celular: true } },
          pj: { select: { razaoSocial: true, celularComercial: true } },
        },
      },
    },
  },
} as const;

type ComSituacao<T> = T & { situacao: StatusCotacaoCronometragem | 'EXPIRADA' };

/**
 * Proposta vencida sem resposta: aparece como EXPIRADA e nao pode ser aceita,
 * mas fica ORCADA no banco para a equipe reenviar com outro prazo.
 */
export function situacaoCotacao(
  c: { status: StatusCotacaoCronometragem; propostaValidaAte: Date | null },
  agora = new Date(),
): StatusCotacaoCronometragem | 'EXPIRADA' {
  if (c.status === S.ORCADA && c.propostaValidaAte && c.propostaValidaAte < agora) {
    return 'EXPIRADA';
  }
  return c.status;
}

/** "2026-10-20" -> 20/10/2026 23:59:59 em Brasilia. */
export function fimDoDiaBrasilia(data: string): Date {
  const d = new Date(`${data}T23:59:59-03:00`);
  if (isNaN(d.getTime())) {
    throw new BadRequestException(`Data inválida: ${data}.`);
  }
  return d;
}

@Injectable()
export class CotacaoCronometragemService {
  private readonly logger = new Logger(CotacaoCronometragemService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly notificacaoAdmin: NotificacaoAdminService,
  ) {}

  // ---------------------------------------------------------------------------
  // Organizador
  // ---------------------------------------------------------------------------

  async solicitar(usuarioId: string, eventoId: string, dto: SolicitarCotacaoDto) {
    const organizador = await this.getOrganizadorAprovadoOuFalhar(usuarioId);

    const evento = await this.prisma.evento.findUnique({ where: { id: eventoId } });
    if (!evento || evento.organizadorId !== organizador.id) {
      throw new NotFoundException('Evento não encontrado.');
    }
    if (evento.status === StatusEvento.CANCELADO || evento.status === StatusEvento.FINALIZADO) {
      throw new BadRequestException('Não é possível pedir cotação para um evento cancelado ou finalizado.');
    }
    if (evento.dataFim < new Date()) {
      throw new BadRequestException('Este evento já aconteceu.');
    }

    const aberta = await this.prisma.cotacaoCronometragem.findFirst({
      where: { eventoId, status: { in: STATUS_ABERTOS } },
    });
    if (aberta) {
      throw new ConflictException(
        'Já existe uma cotação de cronometragem em andamento para este evento.',
      );
    }

    const cotacao = await this.prisma.cotacaoCronometragem.create({
      data: {
        eventoId,
        organizadorId: organizador.id,
        servicos: dto.servicos,
        atletasEstimados: dto.atletasEstimados ?? null,
        pontosPassagem: dto.pontosPassagem ?? null,
        observacoes: dto.observacoes?.trim() || null,
      },
      include: COTACAO_INCLUDE,
    });

    this.avisarAdmin(
      'Nova cotação de cronometragem',
      `${evento.nome}: o organizador pediu uma cotação.`,
    );

    return this.comSituacao(cotacao);
  }

  async listarMinhas(usuarioId: string) {
    const organizador = await this.getOrganizadorOuFalhar(usuarioId);

    const cotacoes = await this.prisma.cotacaoCronometragem.findMany({
      where: { organizadorId: organizador.id },
      orderBy: { createdAt: 'desc' },
      include: COTACAO_INCLUDE,
    });

    // Dados de pagamento so aparecem depois de aceita a proposta.
    const precisaDados = cotacoes.some((c) => c.status === S.ACEITA);
    const dadosPagamento = precisaDados ? await this.obterDadosPagamento() : null;

    return cotacoes.map((c) => ({
      ...this.comSituacao(c),
      dadosPagamento: c.status === S.ACEITA ? dadosPagamento : null,
    }));
  }

  async aceitar(usuarioId: string, id: string) {
    const cotacao = await this.buscarDoOrganizador(usuarioId, id, true);

    // A condicao vai no proprio update: proposta vencida ou reenviada no meio
    // do caminho nao e aceita.
    const { count } = await this.prisma.cotacaoCronometragem.updateMany({
      where: { id, status: S.ORCADA, propostaValidaAte: { gte: new Date() } },
      data: { status: S.ACEITA, aceitaEm: new Date() },
    });
    if (count === 0) {
      throw new ConflictException(
        situacaoCotacao(cotacao) === 'EXPIRADA'
          ? 'Esta proposta venceu. Peça à equipe do Seu Percurso uma proposta atualizada.'
          : 'Esta cotação não tem uma proposta aguardando resposta.',
      );
    }

    this.avisarAdmin(
      'Proposta de cronometragem aceita',
      `${cotacao.evento.nome}: o organizador aceitou a proposta.`,
    );

    return this.recarregar(id);
  }

  async recusar(usuarioId: string, id: string, motivo?: string) {
    await this.buscarDoOrganizador(usuarioId, id, true);

    const { count } = await this.prisma.cotacaoCronometragem.updateMany({
      where: { id, status: S.ORCADA },
      data: { status: S.RECUSADA, motivo: motivo?.trim() || null },
    });
    if (count === 0) {
      throw new ConflictException('Esta cotação não tem uma proposta aguardando resposta.');
    }

    return this.recarregar(id);
  }

  async cancelarPeloOrganizador(usuarioId: string, id: string, motivo?: string) {
    const cotacao = await this.buscarDoOrganizador(usuarioId, id, true);

    // Depois de paga, cancelar envolve devolver dinheiro: fica com a equipe.
    const { count } = await this.prisma.cotacaoCronometragem.updateMany({
      where: { id, status: { in: [S.SOLICITADA, S.ORCADA, S.ACEITA] } },
      data: { status: S.CANCELADA, motivo: motivo?.trim() || null },
    });
    if (count === 0) {
      throw new ConflictException(
        'Esta cotação não pode mais ser cancelada pelo painel. Fale com a equipe do Seu Percurso.',
      );
    }

    if (cotacao.status !== S.SOLICITADA) {
      this.avisarAdmin(
        'Cotação de cronometragem cancelada',
        `${cotacao.evento.nome}: o organizador cancelou a cotação.`,
      );
    }

    return this.recarregar(id);
  }

  async enviarComprovante(usuarioId: string, id: string, arquivoUrl: string) {
    const cotacao = await this.buscarDoOrganizador(usuarioId, id, true);

    const { count } = await this.prisma.cotacaoCronometragem.updateMany({
      where: { id, status: S.ACEITA },
      data: { comprovanteUrl: arquivoUrl, comprovanteEnviadoEm: new Date() },
    });
    if (count === 0) {
      throw new ConflictException(
        'O comprovante só pode ser enviado depois de aceitar a proposta e antes da confirmação do pagamento.',
      );
    }

    this.avisarAdmin(
      'Comprovante de cronometragem enviado',
      `${cotacao.evento.nome}: o organizador enviou o comprovante de pagamento.`,
    );

    return this.recarregar(id);
  }

  // ---------------------------------------------------------------------------
  // Admin
  // ---------------------------------------------------------------------------

  async listarTodas(status?: string) {
    const filtro =
      status && (Object.values(S) as string[]).includes(status)
        ? { status: status as StatusCotacaoCronometragem }
        : undefined;

    const cotacoes = await this.prisma.cotacaoCronometragem.findMany({
      where: filtro,
      orderBy: { createdAt: 'desc' },
      include: COTACAO_ADMIN_INCLUDE,
    });

    return cotacoes.map((c) => this.comSituacao(c));
  }

  async buscarAdmin(id: string) {
    const cotacao = await this.prisma.cotacaoCronometragem.findUnique({
      where: { id },
      include: {
        ...COTACAO_ADMIN_INCLUDE,
        evento: {
          select: {
            ...COTACAO_INCLUDE.evento.select,
            modalidades: { select: { nome: true, distanciaKm: true } },
          },
        },
      },
    });
    if (!cotacao) {
      throw new NotFoundException('Cotação não encontrada.');
    }

    const inscritosConfirmados = await this.prisma.inscricao.count({
      where: {
        status: StatusInscricao.CONFIRMADA,
        categoria: { modalidade: { eventoId: cotacao.eventoId } },
      },
    });

    return { ...this.comSituacao(cotacao), inscritosConfirmados };
  }

  async enviarProposta(id: string, dto: PropostaCotacaoDto) {
    const cotacao = await this.buscarAdminOuFalhar(id);

    const propostaValidaAte = fimDoDiaBrasilia(dto.propostaValidaAte);
    const pagamentoAte = fimDoDiaBrasilia(dto.pagamentoAte);
    if (propostaValidaAte < new Date()) {
      throw new BadRequestException('A validade da proposta precisa ser hoje ou depois.');
    }
    if (pagamentoAte < propostaValidaAte) {
      throw new BadRequestException('O prazo de pagamento não pode ser antes da validade da proposta.');
    }

    // Reenviar (outro preco, prazo vencido) tambem passa por aqui.
    const { count } = await this.prisma.cotacaoCronometragem.updateMany({
      where: { id, status: { in: [S.SOLICITADA, S.ORCADA] } },
      data: {
        status: S.ORCADA,
        valor: dto.valor,
        descricaoProposta: dto.descricao.trim(),
        propostaValidaAte,
        pagamentoAte,
        propostaEnviadaEm: new Date(),
      },
    });
    if (count === 0) {
      throw new ConflictException(
        `Só dá para enviar proposta para cotação solicitada ou já orçada. Situação atual: ${cotacao.status}.`,
      );
    }

    this.avisarOrganizador(cotacao, {
      tipo: 'PROPOSTA',
      valor: dto.valor,
      propostaValidaAte,
    });

    return this.buscarAdmin(id);
  }

  async confirmarPagamento(id: string, cronometradoraId?: string) {
    const cotacao = await this.buscarAdminOuFalhar(id);

    if (cronometradoraId) {
      const cronometradora = await this.prisma.cronometradora.findUnique({
        where: { id: cronometradoraId },
      });
      if (!cronometradora) {
        throw new NotFoundException('Cronometradora não encontrada.');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.cotacaoCronometragem.updateMany({
        where: { id, status: S.ACEITA },
        data: {
          status: S.PAGA,
          pagaEm: new Date(),
          cronometradoraId: cronometradoraId ?? null,
        },
      });
      if (count === 0) {
        throw new ConflictException(
          `Só dá para confirmar o pagamento de uma proposta aceita. Situação atual: ${cotacao.status}.`,
        );
      }

      if (!cronometradoraId) return;

      // Mesmo acesso que o organizador daria aprovando o pedido da
      // cronometradora: ate 7 dias depois do fim da prova.
      const validaAte = new Date(cotacao.evento.dataFim);
      validaAte.setDate(validaAte.getDate() + 7);

      const existente = await tx.solicitacaoCronometragem.findFirst({
        where: {
          cronometradoraId,
          eventoId: cotacao.eventoId,
          status: { in: ['PENDENTE', 'APROVADA'] },
        },
      });

      if (existente) {
        await tx.solicitacaoCronometragem.update({
          where: { id: existente.id },
          data: {
            status: 'APROVADA',
            respondidaEm: existente.respondidaEm ?? new Date(),
            validaAte:
              existente.validaAte && existente.validaAte > validaAte
                ? existente.validaAte
                : validaAte,
          },
        });
      } else {
        await tx.solicitacaoCronometragem.create({
          data: {
            cronometradoraId,
            eventoId: cotacao.eventoId,
            status: 'APROVADA',
            mensagem: 'Cronometragem contratada pelo organizador no Seu Percurso.',
            respondidaEm: new Date(),
            validaAte,
          },
        });
      }
    });

    this.avisarOrganizador(cotacao, { tipo: 'PAGAMENTO_CONFIRMADO' });

    return this.buscarAdmin(id);
  }

  async concluir(id: string) {
    const cotacao = await this.buscarAdminOuFalhar(id);

    const { count } = await this.prisma.cotacaoCronometragem.updateMany({
      where: { id, status: S.PAGA },
      data: { status: S.CONCLUIDA, concluidaEm: new Date() },
    });
    if (count === 0) {
      throw new ConflictException(
        `Só dá para concluir uma cotação paga. Situação atual: ${cotacao.status}.`,
      );
    }

    return this.buscarAdmin(id);
  }

  async cancelarPelaEquipe(id: string, motivo?: string) {
    const cotacao = await this.buscarAdminOuFalhar(id);

    // Paga ou concluida envolve dinheiro recebido: nao cancela por aqui.
    const { count } = await this.prisma.cotacaoCronometragem.updateMany({
      where: { id, status: { in: [S.SOLICITADA, S.ORCADA, S.ACEITA] } },
      data: { status: S.CANCELADA, motivo: motivo?.trim() || null },
    });
    if (count === 0) {
      throw new ConflictException(
        `Esta cotação não pode ser cancelada. Situação atual: ${cotacao.status}.`,
      );
    }

    this.avisarOrganizador(cotacao, { tipo: 'CANCELADA', motivo: motivo?.trim() || null });

    return this.buscarAdmin(id);
  }

  async obterDadosPagamento(): Promise<string | null> {
    const config = await this.prisma.configuracaoPlataforma.findUnique({
      where: { id: 'default' },
      select: { dadosPagamentoCronometragem: true },
    });
    return config?.dadosPagamentoCronometragem ?? null;
  }

  async salvarDadosPagamento(dados?: string) {
    const valor = dados?.trim() || null;
    const config = await this.prisma.configuracaoPlataforma.upsert({
      where: { id: 'default' },
      update: { dadosPagamentoCronometragem: valor },
      create: { id: 'default', dadosPagamentoCronometragem: valor },
      select: { dadosPagamentoCronometragem: true },
    });
    return { dados: config.dadosPagamentoCronometragem };
  }

  // ---------------------------------------------------------------------------
  // Apoio
  // ---------------------------------------------------------------------------

  private comSituacao<T extends { status: StatusCotacaoCronometragem; propostaValidaAte: Date | null }>(
    c: T,
  ): ComSituacao<T> {
    return { ...c, situacao: situacaoCotacao(c) };
  }

  private async recarregar(id: string) {
    const cotacao = await this.prisma.cotacaoCronometragem.findUniqueOrThrow({
      where: { id },
      include: COTACAO_INCLUDE,
    });
    const dadosPagamento =
      cotacao.status === S.ACEITA ? await this.obterDadosPagamento() : null;
    return { ...this.comSituacao(cotacao), dadosPagamento };
  }

  private async buscarAdminOuFalhar(id: string) {
    const cotacao = await this.prisma.cotacaoCronometragem.findUnique({
      where: { id },
      include: COTACAO_ADMIN_INCLUDE,
    });
    if (!cotacao) {
      throw new NotFoundException('Cotação não encontrada.');
    }
    return cotacao;
  }

  private async buscarDoOrganizador(usuarioId: string, id: string, exigeAprovado = false) {
    const organizador = exigeAprovado
      ? await this.getOrganizadorAprovadoOuFalhar(usuarioId)
      : await this.getOrganizadorOuFalhar(usuarioId);

    const cotacao = await this.prisma.cotacaoCronometragem.findUnique({
      where: { id },
      include: COTACAO_INCLUDE,
    });
    // Cotacao de outro organizador responde igual a inexistente.
    if (!cotacao || cotacao.organizadorId !== organizador.id) {
      throw new NotFoundException('Cotação não encontrada.');
    }
    return cotacao;
  }

  private async getOrganizadorOuFalhar(usuarioId: string) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { usuarioId },
      select: { organizador: { select: { id: true, status: true } } },
    });
    if (!cliente?.organizador) {
      throw new ForbiddenException('Você ainda não solicitou cadastro como organizador.');
    }
    return cliente.organizador;
  }

  private async getOrganizadorAprovadoOuFalhar(usuarioId: string) {
    const organizador = await this.getOrganizadorOuFalhar(usuarioId);
    if (organizador.status !== StatusOrganizador.APROVADO) {
      throw new ForbiddenException('Seu cadastro de organizador ainda não foi aprovado.');
    }
    return organizador;
  }

  /** Aviso nunca derruba a acao que ja foi gravada. */
  private avisarAdmin(title: string, body: string) {
    this.notificacaoAdmin
      .enviarPushParaTodos({ title, body, url: '/cotacoes-cronometragem' })
      .catch((err) => this.logger.warn(`Push da cotação não enviado: ${err}`));
  }

  private avisarOrganizador(
    cotacao: Awaited<ReturnType<CotacaoCronometragemService['buscarAdminOuFalhar']>>,
    aviso: {
      tipo: 'PROPOSTA' | 'PAGAMENTO_CONFIRMADO' | 'CANCELADA';
      valor?: number;
      propostaValidaAte?: Date;
      motivo?: string | null;
    },
  ) {
    const cliente = cotacao.organizador.cliente;
    const email = cliente.usuario.email;
    if (!email) return;

    this.emailService
      .enviarAvisoCotacaoCronometragem({
        email,
        nomeOrganizador: cliente.pf?.nomeCompleto || cliente.pj?.razaoSocial || 'organizador',
        nomeEvento: cotacao.evento.nome,
        ...aviso,
      })
      .catch((err) => this.logger.warn(`E-mail da cotação não enviado: ${err}`));
  }
}
