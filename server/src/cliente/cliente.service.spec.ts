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
    clientePf: {
      create: jest.Mock;
      update: jest.Mock;
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
      clientePf: {
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [ClienteService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(ClienteService);
  });

  describe('createPessoaFisica', () => {
    // Ter cliente e ter perfil sao coisas diferentes: quem se cadastrou como PJ,
    // ou parou no meio, ja tem cliente e nenhum perfil PF. Recusar aqui, como
    // era antes, deixava essa pessoa sem como concluir o cadastro.
    it('cria o perfil PF quando o cliente existe mas ainda não tem um', async () => {
      prisma.cliente.findUnique.mockResolvedValue({ id: 'cliente-1', pf: null });
      const criado = { clienteId: 'cliente-1', nomeCompleto: dtoPf.nomeCompleto };
      prisma.clientePf.create.mockResolvedValue(criado);

      const resultado = await service.createPessoaFisica(usuarioId, { ...dtoPf });

      expect(prisma.clientePf.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          clienteId: 'cliente-1',
          nomeCompleto: dtoPf.nomeCompleto,
        }),
      });
      expect(prisma.cliente.create).not.toHaveBeenCalled();
      expect(resultado).toEqual(criado);
    });

    it('atualiza o perfil PF existente em vez de duplicar', async () => {
      prisma.cliente.findUnique.mockResolvedValue({
        id: 'cliente-1',
        pf: { clienteId: 'cliente-1' },
      });
      prisma.clientePf.update.mockResolvedValue({ clienteId: 'cliente-1' });

      await service.createPessoaFisica(usuarioId, { ...dtoPf });

      expect(prisma.clientePf.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { clienteId: 'cliente-1' } }),
      );
      expect(prisma.clientePf.create).not.toHaveBeenCalled();
    });

    it('grava o CPF só com dígitos', async () => {
      prisma.cliente.findUnique.mockResolvedValue(null);
      prisma.cliente.create.mockResolvedValue({ id: 'cliente-1' });

      await service.createPessoaFisica(usuarioId, {
        ...dtoPf,
        cpf: '111.444.777-35',
      });

      expect(prisma.cliente.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            pf: { create: expect.objectContaining({ cpf: '11144477735' }) },
          }),
        }),
      );
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

      // Copia proposital: o servico normaliza o CPF alterando o dto recebido, e
      // passar o objeto do teste fazia a assercao comparar com o valor ja
      // corrigido — ela passaria mesmo se a normalizacao sumisse.
      const resultado = await service.createPessoaFisica(usuarioId, { ...dtoPf });

      expect(prisma.cliente.create).toHaveBeenCalledWith({
        data: {
          usuarioId,
          pf: {
            create: {
              ...dtoPf,
              cpf: '11144477735',
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
