import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDependenteDto } from './dto/create-dependente.dto';
import { UpdateDependenteDto } from './dto/update-dependente.dto';

@Injectable()
export class DependenteService {
  constructor(private readonly prisma: PrismaService) {}

  async create(usuarioId: string, dto: CreateDependenteDto) {
    const clienteId = await this.getClienteIdOuFalhar(usuarioId);
    const cpfLimpo = dto.cpf.replace(/\D/g, '');

    const dependenteExistente = await this.prisma.dependente.findFirst({
      where: {
        clienteId,
        cpf: cpfLimpo,
      },
    });

    if (dependenteExistente) {
      throw new ConflictException(
        'Você já possui um dependente cadastrado com este CPF.',
      );
    }

    return this.prisma.dependente.create({
      data: {
        clienteId,
        nomeCompleto: dto.nomeCompleto.trim(),
        cpf: cpfLimpo,
        dataNascimento: new Date(dto.dataNascimento),
        genero: dto.genero,
        pcd: dto.pcd ?? false,
        celular: dto.celular ? dto.celular.trim() : null,
      },
    });
  }

  async findAll(usuarioId: string) {
    const clienteId = await this.getClienteId(usuarioId);
    if (!clienteId) return [];
    return this.prisma.dependente.findMany({
      where: { clienteId },
      orderBy: { nomeCompleto: 'asc' },
    });
  }

  async findOne(usuarioId: string, id: string) {
    const clienteId = await this.getClienteIdOuFalhar(usuarioId);
    const dependente = await this.prisma.dependente.findFirst({
      where: { id, clienteId },
    });
    if (!dependente) {
      throw new NotFoundException('Dependente não encontrado.');
    }
    return dependente;
  }

  async update(usuarioId: string, id: string, dto: UpdateDependenteDto) {
    const dependente = await this.findOne(usuarioId, id);

    const cpfLimpo = dto.cpf ? dto.cpf.replace(/\D/g, '') : dependente.cpf;

    if (dto.cpf && cpfLimpo !== dependente.cpf) {
      const duplicado = await this.prisma.dependente.findFirst({
        where: {
          clienteId: dependente.clienteId,
          cpf: cpfLimpo,
          id: { not: id },
        },
      });
      if (duplicado) {
        throw new ConflictException(
          'Você já possui outro dependente cadastrado com este CPF.',
        );
      }
    }

    return this.prisma.dependente.update({
      where: { id },
      data: {
        ...(dto.nomeCompleto && { nomeCompleto: dto.nomeCompleto.trim() }),
        ...(dto.cpf && { cpf: cpfLimpo }),
        ...(dto.dataNascimento && { dataNascimento: new Date(dto.dataNascimento) }),
        ...(dto.genero && { genero: dto.genero }),
        ...(dto.pcd !== undefined && { pcd: dto.pcd }),
        ...(dto.celular !== undefined && { celular: dto.celular ? dto.celular.trim() : null }),
      },
    });
  }

  async remove(usuarioId: string, id: string) {
    await this.findOne(usuarioId, id);

    const inscricoesAtivas = await this.prisma.inscricao.count({
      where: { dependenteId: id },
    });

    if (inscricoesAtivas > 0) {
      throw new BadRequestException(
        'Este dependente possui inscrições vinculadas em eventos e não pode ser excluído.',
      );
    }

    return this.prisma.dependente.delete({
      where: { id },
    });
  }

  private async getClienteId(usuarioId: string): Promise<string | null> {
    if (!usuarioId) return null;
    const cliente = await this.prisma.cliente.findUnique({
      where: { usuarioId },
    });
    return cliente ? cliente.id : null;
  }

  private async getClienteIdOuFalhar(usuarioId: string): Promise<string> {
    const clienteId = await this.getClienteId(usuarioId);
    if (!clienteId) {
      throw new NotFoundException(
        'Perfil de cliente não encontrado. Complete seu cadastro primeiro.',
      );
    }
    return clienteId;
  }
}
