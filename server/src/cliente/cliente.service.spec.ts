import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ClienteService } from './cliente.service';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';

describe('ClienteService', () => {
  let service: ClienteService;
  let prisma: {
    cliente: {
      findUnique: jest.Mock;
      create: jest.Mock;
    };
  };

  const usuarioId = 'usuario-1';
  const dtoPf = {
    nomeCompleto: 'Fulano de Tal',
    cpf: '111.444.777-35',
    dataNascimento: '1990-01-01',
    genero: 'MASCULINO' as const,
    celular: '11999998888',
  };

  beforeEach(async () => {
    prisma = {
      cliente: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [ClienteService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(ClienteService);
  });

  describe('createPessoaFisica', () => {
    it('lança ConflictException se o usuário já tiver um cliente', async () => {
      prisma.cliente.findUnique.mockResolvedValue({ id: 'cliente-1' });

      await expect(
        service.createPessoaFisica(usuarioId, dtoPf),
      ).rejects.toThrow(ConflictException);
      expect(prisma.cliente.create).not.toHaveBeenCalled();
    });

    it('lança ConflictException se o CPF já estiver em uso (P2002)', async () => {
      prisma.cliente.findUnique.mockResolvedValue(null);
      prisma.cliente.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(
        service.createPessoaFisica(usuarioId, dtoPf),
      ).rejects.toThrow(ConflictException);
    });

    it('cria o cliente com o perfil PF aninhado', async () => {
      prisma.cliente.findUnique.mockResolvedValue(null);
      const criado = { id: 'cliente-1', usuarioId, pf: dtoPf };
      prisma.cliente.create.mockResolvedValue(criado);

      const resultado = await service.createPessoaFisica(usuarioId, dtoPf);

      expect(prisma.cliente.create).toHaveBeenCalledWith({
        data: {
          usuarioId,
          pf: {
            create: {
              ...dtoPf,
              dataNascimento: new Date(dtoPf.dataNascimento),
            },
          },
        },
        include: { pf: true },
      });
      expect(resultado).toEqual(criado);
    });
  });

  describe('getMe', () => {
    it('lança NotFoundException se o cliente não existir', async () => {
      prisma.cliente.findUnique.mockResolvedValue(null);

      await expect(service.getMe(usuarioId)).rejects.toThrow(NotFoundException);
    });

    it('retorna o cliente encontrado', async () => {
      const cliente = { id: 'cliente-1', usuarioId, pf: dtoPf, pj: null };
      prisma.cliente.findUnique.mockResolvedValue(cliente);

      await expect(service.getMe(usuarioId)).resolves.toEqual(cliente);
    });
  });
});
