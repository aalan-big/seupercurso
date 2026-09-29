import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CriarCronometradoraDto,
  RenovarAssinaturaDto,
  VincularUsuarioCronometradoraDto,
  AtualizarUsuarioCronometradoraDto,
} from './dto/admin-cronometragem.dto';
import { StatusCronometradora } from '../generated/prisma/enums';

/**
 * "2026-12-31" vira 31/12 às 23:59:59 de Brasília. `new Date('2026-12-31')`
 * cairia à meia-noite UTC, ou seja, 21h do dia 30 no horário de Brasília.
 */
function lerDataValidade(valor: string): Date {
  const data = /^\d{4}-\d{2}-\d{2}$/.test(valor)
    ? new Date(`${valor}T23:59:59.999-03:00`)
    : new Date(valor);
  if (isNaN(data.getTime())) {
    throw new BadRequestException('Data de validade da assinatura inválida.');
  }
  return data;
}

@Injectable()
export class AdminCronometragemService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lista todas as empresas de cronometragem cadastradas
   */
  async listarCronometradoras() {
    return this.prisma.cronometradora.findMany({
      include: {
        _count: {
          select: {
            usuarios: true,
            solicitacoes: true,
            passagens: true,
          },
        },
        usuarios: {
          include: {
            usuario: {
              select: {
                id: true,
                email: true,
                cliente: {
                  select: {
                    pf: { select: { nomeCompleto: true } },
                    pj: { select: { razaoSocial: true, nomeFantasia: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Cria nova empresa de cronometragem
   */
  async criarCronometradora(dto: CriarCronometradoraDto) {
    let validaAte = new Date();
    if (dto.assinaturaValidaAte) {
      validaAte = lerDataValidade(dto.assinaturaValidaAte);
    } else {
      validaAte.setFullYear(validaAte.getFullYear() + 1);
    }

    return this.prisma.cronometradora.create({
      data: {
        nome: dto.nome.trim(),
        documento: dto.documento?.trim() || null,
        plano: dto.plano?.trim() || 'Cronometragem anual',
        assinaturaValidaAte: validaAte,
        status: 'ATIVA',
      },
    });
  }

  /**
   * Renova ou estende a data da assinatura anual da cronometradora
   */
  async renovarAssinatura(id: string, dto: RenovarAssinaturaDto) {
    const crono = await this.prisma.cronometradora.findUnique({
      where: { id },
    });

    if (!crono) {
      throw new NotFoundException('Empresa de cronometragem não encontrada.');
    }

    let novaData: Date;
    if (dto.novaData) {
      novaData = lerDataValidade(dto.novaData);
    } else {
      const base =
        crono.assinaturaValidaAte > new Date()
          ? new Date(crono.assinaturaValidaAte)
          : new Date();
      if (dto.meses) {
        base.setMonth(base.getMonth() + dto.meses);
      } else {
        base.setDate(base.getDate() + (dto.dias || 365));
      }
      novaData = base;
    }

    return this.prisma.cronometradora.update({
      where: { id },
      data: {
        assinaturaValidaAte: novaData,
        status: 'ATIVA',
      },
    });
  }

  /**
   * Bloqueia, cancela ou reativa empresa de cronometragem
   */
  async alterarStatus(id: string, status: StatusCronometradora) {
    const crono = await this.prisma.cronometradora.findUnique({
      where: { id },
    });

    if (!crono) {
      throw new NotFoundException('Empresa de cronometragem não encontrada.');
    }

    return this.prisma.cronometradora.update({
      where: { id },
      data: { status },
    });
  }

  /**
   * Vincula usuário do sistema (pelo e-mail) à empresa de cronometragem
   */
  async vincularUsuario(cronometradoraId: string, dto: VincularUsuarioCronometradoraDto) {
    const crono = await this.prisma.cronometradora.findUnique({
      where: { id: cronometradoraId },
    });

    if (!crono) {
      throw new NotFoundException('Empresa de cronometragem não encontrada.');
    }

    const emailLimpo = dto.email.trim().toLowerCase();
    const usuario = await this.prisma.usuario.findFirst({
      where: { email: { equals: emailLimpo, mode: 'insensitive' } },
    });

    if (!usuario) {
      throw new NotFoundException(
        `Nenhum usuário cadastrado com o e-mail "${dto.email}". O usuário deve criar uma conta primeiro.`,
      );
    }

    return this.prisma.usuarioCronometragem.upsert({
      where: { usuarioId: usuario.id },
      create: {
        usuarioId: usuario.id,
        cronometradoraId,
        papel: dto.papel || 'OPERADOR',
        ativo: true,
      },
      update: {
        cronometradoraId,
        papel: dto.papel || 'OPERADOR',
        ativo: true,
      },
      include: {
        usuario: {
          select: {
            id: true,
            email: true,
            cliente: { select: { pf: true, pj: true } },
          },
        },
      },
    });
  }

  /**
   * Ativa, desativa ou remove vínculo do usuário com a cronometradora
   */
  async atualizarUsuarioVinculo(
    usuarioId: string,
    dto: AtualizarUsuarioCronometradoraDto,
  ) {
    const vinculo = await this.prisma.usuarioCronometragem.findUnique({
      where: { usuarioId },
    });

    if (!vinculo) {
      throw new NotFoundException('Vínculo de cronometragem não encontrado para este usuário.');
    }

    if (dto.desvincular) {
      await this.prisma.usuarioCronometragem.delete({
        where: { usuarioId },
      });
      return { sucesso: true, mensagem: 'Vínculo removido com sucesso.' };
    }

    return this.prisma.usuarioCronometragem.update({
      where: { usuarioId },
      data: {
        ativo: dto.ativo !== undefined ? dto.ativo : vinculo.ativo,
        papel: dto.papel || vinculo.papel,
      },
    });
  }

  /**
   * Lista todos os pedidos de acesso de todas as provas
   */
  async listarSolicitacoes() {
    const agora = new Date();
    await this.prisma.solicitacaoCronometragem.updateMany({
      where: {
        status: 'APROVADA',
        OR: [{ validaAte: null }, { validaAte: { lt: agora } }],
      },
      data: {
        status: 'EXPIRADA',
      },
    });

    return this.prisma.solicitacaoCronometragem.findMany({
      include: {
        cronometradora: true,
        evento: {
          include: {
            organizador: {
              include: {
                cliente: {
                  include: { pf: true, pj: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /**
   * Lista auditoria de acessos
   */
  async listarAuditoria() {
    return this.prisma.auditoriaCronometragem.findMany({
      include: {
        cronometradora: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 150,
    });
  }
}
