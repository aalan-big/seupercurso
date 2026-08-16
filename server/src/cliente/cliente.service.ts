import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { CreateClientePfDto } from './dto/create-cliente-pf.dto';
import { CreateClientePjDto } from './dto/create-cliente-pj.dto';
import { CreateEnderecoDto } from './dto/create-endereco.dto';
import { UpdateClientePfDto } from './dto/update-cliente-pf.dto';

@Injectable()
export class ClienteService {
  constructor(private readonly prisma: PrismaService) {}

  async createPessoaFisica(usuarioId: string, dto: CreateClientePfDto) {
    await this.garantirQueAindaNaoTemPerfil(usuarioId);

    try {
      return await this.prisma.cliente.create({
        data: {
          usuarioId,
          pf: {
            create: { ...dto, dataNascimento: new Date(dto.dataNascimento) },
          },
        },
        include: { pf: true },
      });
    } catch (error) {
      throw this.tratarErroDeUnicidade(
        error,
        'Já existe um cadastro com esse CPF.',
      );
    }
  }

  async createPessoaJuridica(usuarioId: string, dto: CreateClientePjDto) {
    await this.garantirQueAindaNaoTemPerfil(usuarioId);

    try {
      return await this.prisma.cliente.create({
        data: {
          usuarioId,
          pj: { create: dto },
        },
        include: { pj: true },
      });
    } catch (error) {
      throw this.tratarErroDeUnicidade(
        error,
        'Já existe um cadastro com esse CNPJ.',
      );
    }
  }

  async getMe(usuarioId: string) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { usuarioId },
      include: { pf: true, pj: true, enderecos: true },
    });

    if (!cliente) {
      throw new NotFoundException('Perfil de cliente ainda não cadastrado.');
    }

    return cliente;
  }

  async createEndereco(usuarioId: string, dto: CreateEnderecoDto) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { usuarioId },
    });

    if (!cliente) {
      throw new NotFoundException(
        'Complete seu perfil antes de cadastrar um endereço.',
      );
    }

    return this.prisma.endereco.create({
      data: { ...dto, clienteId: cliente.id },
    });
  }

  async updatePessoaFisica(usuarioId: string, dto: UpdateClientePfDto) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { usuarioId },
      include: { pf: true },
    });

    if (!cliente?.pf) {
      throw new NotFoundException('Perfil de atleta ainda não cadastrado.');
    }

    try {
      return await this.prisma.clientePf.update({
        where: { clienteId: cliente.id },
        data: {
          ...dto,
          ...(dto.dataNascimento
            ? { dataNascimento: new Date(dto.dataNascimento) }
            : {}),
        },
      });
    } catch (error) {
      throw this.tratarErroDeUnicidade(
        error,
        'Já existe um cadastro com esse CPF.',
      );
    }
  }

  async updateEndereco(usuarioId: string, dto: CreateEnderecoDto) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { usuarioId },
      include: { enderecos: true },
    });

    if (!cliente) {
      throw new NotFoundException(
        'Complete seu perfil antes de cadastrar um endereço.',
      );
    }

    const existente = cliente.enderecos[0];

    if (!existente) {
      return this.prisma.endereco.create({
        data: { ...dto, clienteId: cliente.id },
      });
    }

    return this.prisma.endereco.update({
      where: { id: existente.id },
      data: dto,
    });
  }

  async atualizarFoto(usuarioId: string, caminhoRelativo: string) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { usuarioId },
    });

    if (!cliente) {
      throw new NotFoundException(
        'Complete seu perfil antes de adicionar uma foto.',
      );
    }

    if (cliente.fotoPerfil) {
      const antigo = join(process.cwd(), cliente.fotoPerfil);
      unlink(antigo).catch(() => undefined);
    }

    return this.prisma.cliente.update({
      where: { id: cliente.id },
      data: { fotoPerfil: caminhoRelativo },
    });
  }

  async atualizarDocumentoPcd(usuarioId: string, caminhoRelativo: string) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { usuarioId },
      include: { pf: true },
    });

    if (!cliente?.pf) {
      throw new NotFoundException(
        'Complete seu perfil de pessoa física antes de enviar o documento.',
      );
    }

    if (cliente.pf.documentoPcdUrl) {
      const antigo = join(process.cwd(), cliente.pf.documentoPcdUrl);
      unlink(antigo).catch(() => undefined);
    }

    return this.prisma.clientePf.update({
      where: { clienteId: cliente.id },
      data: { documentoPcdUrl: caminhoRelativo },
    });
  }

  private async garantirQueAindaNaoTemPerfil(usuarioId: string) {
    const existente = await this.prisma.cliente.findUnique({
      where: { usuarioId },
    });
    if (existente) {
      throw new ConflictException(
        'Este usuário já tem um perfil de cliente cadastrado.',
      );
    }
  }

  private tratarErroDeUnicidade(error: unknown, mensagem: string) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ConflictException(mensagem);
    }
    return error;
  }
}
