import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CategoriaAuditLog,
  NivelAuditLog,
  StatusSolicitacaoDocumento,
  TipoDocumentoTitular,
} from '../generated/prisma/enums';
import { AuditLogService } from '../audit-log/audit-log.service';
import { cpfEhValido } from '../common/validators/is-cpf.validator';
import { cnpjEhValido } from '../common/validators/is-cnpj.validator';

/**
 * Troca de CPF/CNPJ do titular.
 *
 * O documento define para qual conta o organizador consegue sacar, então não
 * pode ser editável no perfil: quem trocasse o CPF redirecionaria o dinheiro.
 * Toda alteração vira uma solicitação com foto do documento, revisada pelo
 * admin, e congela os saques enquanto estiver pendente.
 */
@Injectable()
export class AlteracaoDocumentoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async solicitar(
    usuarioId: string,
    documentoNovo: string,
    arquivoUrl: string,
    motivo?: string,
  ) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { usuarioId },
      include: { pf: true, pj: true },
    });

    if (!cliente) {
      throw new NotFoundException('Complete seu perfil antes de solicitar a alteração.');
    }

    const ehPj = !!cliente.pj;
    const documentoAtual = (ehPj ? cliente.pj!.cnpj : cliente.pf?.cpf) ?? '';

    if (!documentoAtual) {
      throw new BadRequestException('Nenhum documento cadastrado para alterar.');
    }

    const novo = documentoNovo.replace(/\D/g, '');
    const atual = documentoAtual.replace(/\D/g, '');

    if (novo === atual) {
      throw new BadRequestException('O novo documento é igual ao atual.');
    }

    // O tipo não pode mudar: virar PJ (ou PF) é outro cadastro, não uma correção.
    if (ehPj && novo.length !== 14) {
      throw new BadRequestException('Cadastro de pessoa jurídica exige um CNPJ.');
    }
    if (!ehPj && novo.length !== 11) {
      throw new BadRequestException('Cadastro de pessoa física exige um CPF.');
    }

    const documentoValido = ehPj ? cnpjEhValido(novo) : cpfEhValido(novo);
    if (!documentoValido) {
      throw new BadRequestException(
        ehPj ? 'CNPJ inválido.' : 'CPF inválido.',
      );
    }

    await this.garantirDocumentoLivre(ehPj, novo);

    const pendente = await this.prisma.solicitacaoAlteracaoDocumento.findFirst({
      where: { clienteId: cliente.id, status: StatusSolicitacaoDocumento.PENDENTE },
    });
    if (pendente) {
      throw new ConflictException(
        'Você já tem uma solicitação de alteração em análise.',
      );
    }

    const solicitacao = await this.prisma.solicitacaoAlteracaoDocumento.create({
      data: {
        clienteId: cliente.id,
        tipo: ehPj ? TipoDocumentoTitular.CNPJ : TipoDocumentoTitular.CPF,
        documentoAtual: atual,
        documentoNovo: novo,
        arquivoUrl,
        motivo: motivo?.trim() || null,
      },
    });

    this.auditLogService.log({
      categoria: CategoriaAuditLog.SEGURANCA,
      nivel: NivelAuditLog.WARN,
      mensagem: `Solicitação de alteração de ${ehPj ? 'CNPJ' : 'CPF'} aberta`,
      detalhes: {
        solicitacaoId: solicitacao.id,
        clienteId: cliente.id,
        documentoAtual: atual,
        documentoNovo: novo,
      },
      usuarioId,
    });

    return solicitacao;
  }

  async listarMinhas(usuarioId: string) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { usuarioId },
      select: { id: true },
    });
    if (!cliente) return [];

    return this.prisma.solicitacaoAlteracaoDocumento.findMany({
      where: { clienteId: cliente.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listarParaAdmin(status?: StatusSolicitacaoDocumento) {
    return this.prisma.solicitacaoAlteracaoDocumento.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'asc' },
      include: {
        cliente: {
          include: {
            usuario: { select: { email: true } },
            pf: { select: { nomeCompleto: true, cpf: true } },
            pj: { select: { razaoSocial: true, cnpj: true } },
            organizador: { select: { id: true, status: true } },
          },
        },
      },
    });
  }

  async aprovar(adminId: string, solicitacaoId: string) {
    const solicitacao = await this.buscarPendenteOuFalhar(solicitacaoId);

    const ehPj = solicitacao.tipo === TipoDocumentoTitular.CNPJ;
    await this.garantirDocumentoLivre(ehPj, solicitacao.documentoNovo);

    await this.prisma.$transaction(async (tx) => {
      if (ehPj) {
        await tx.clientePj.update({
          where: { clienteId: solicitacao.clienteId },
          data: { cnpj: solicitacao.documentoNovo },
        });
      } else {
        await tx.clientePf.update({
          where: { clienteId: solicitacao.clienteId },
          data: { cpf: solicitacao.documentoNovo },
        });
      }

      // A subconta do Asaas fica vinculada ao documento: com outro CPF/CNPJ ela
      // não vale mais e precisa ser recriada, senão o saque continuaria indo
      // para o titular antigo.
      await tx.organizador.updateMany({
        where: { clienteId: solicitacao.clienteId },
        data: { asaasAccountId: null, asaasWalletId: null, asaasApiKey: null },
      });

      await tx.solicitacaoAlteracaoDocumento.update({
        where: { id: solicitacao.id },
        data: {
          status: StatusSolicitacaoDocumento.APROVADA,
          revisadoEm: new Date(),
          revisadoPorId: adminId,
        },
      });
    });

    this.auditLogService.log({
      categoria: CategoriaAuditLog.SEGURANCA,
      nivel: NivelAuditLog.WARN,
      mensagem: `Alteração de ${ehPj ? 'CNPJ' : 'CPF'} aprovada; subconta Asaas invalidada para recriação`,
      detalhes: {
        solicitacaoId: solicitacao.id,
        clienteId: solicitacao.clienteId,
        documentoAnterior: solicitacao.documentoAtual,
        documentoNovo: solicitacao.documentoNovo,
        adminId,
      },
    });

    return this.prisma.solicitacaoAlteracaoDocumento.findUnique({
      where: { id: solicitacao.id },
    });
  }

  async rejeitar(adminId: string, solicitacaoId: string, motivo?: string) {
    const solicitacao = await this.buscarPendenteOuFalhar(solicitacaoId);

    // O motivo volta para o organizador; sem ele o pedido seria recusado sem
    // que ele soubesse o que corrigir.
    const motivoFinal = motivo?.trim();
    if (!motivoFinal) {
      throw new BadRequestException('Informe o motivo da recusa.');
    }

    const atualizada = await this.prisma.solicitacaoAlteracaoDocumento.update({
      where: { id: solicitacao.id },
      data: {
        status: StatusSolicitacaoDocumento.REJEITADA,
        motivoRejeicao: motivoFinal,
        revisadoEm: new Date(),
        revisadoPorId: adminId,
      },
    });

    this.auditLogService.log({
      categoria: CategoriaAuditLog.SEGURANCA,
      nivel: NivelAuditLog.INFO,
      mensagem: 'Solicitação de alteração de documento rejeitada',
      detalhes: { solicitacaoId: solicitacao.id, motivo: motivoFinal, adminId },
    });

    return atualizada;
  }

  private async buscarPendenteOuFalhar(solicitacaoId: string) {
    const solicitacao = await this.prisma.solicitacaoAlteracaoDocumento.findUnique({
      where: { id: solicitacaoId },
    });

    if (!solicitacao) {
      throw new NotFoundException('Solicitação não encontrada.');
    }
    if (solicitacao.status !== StatusSolicitacaoDocumento.PENDENTE) {
      throw new BadRequestException('Esta solicitação já foi revisada.');
    }

    return solicitacao;
  }

  /** Impede assumir o documento de outra conta já cadastrada. */
  private async garantirDocumentoLivre(ehPj: boolean, documento: string) {
    const jaExiste = ehPj
      ? await this.prisma.clientePj.findUnique({ where: { cnpj: documento } })
      : await this.prisma.clientePf.findUnique({ where: { cpf: documento } });

    if (jaExiste) {
      throw new ConflictException(
        'Este documento já está cadastrado em outra conta.',
      );
    }
  }
}
