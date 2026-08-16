import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { InscricaoService } from './inscricao.service';
import { PrismaService } from '../prisma/prisma.service';

describe('InscricaoService', () => {
  let service: InscricaoService;
  let prisma: {
    cliente: { findUnique: jest.Mock };
    categoria: { findUnique: jest.Mock };
    lote: { findUnique: jest.Mock };
    loteModalidadePreco: { findUnique: jest.Mock };
    inscricao: { findFirst: jest.Mock; create: jest.Mock; findMany: jest.Mock };
  };

  const usuarioId = 'usuario-1';
  const clienteId = 'cliente-1';
  const eventoId = 'evento-1';
  const dto = { categoriaId: 'categoria-1', loteId: 'lote-1' };

  const categoriaPadrao = {
    id: 'categoria-1',
    modalidadeId: 'modalidade-1',
    modalidade: { id: 'modalidade-1', eventoId },
  };
  const lotePadrao = {
    id: 'lote-1',
    eventoId,
    inicioVenda: new Date(Date.now() - 1000 * 60 * 60 * 24),
    fimVenda: new Date(Date.now() + 1000 * 60 * 60 * 24),
  };

  beforeEach(async () => {
    prisma = {
      cliente: { findUnique: jest.fn() },
      categoria: { findUnique: jest.fn() },
      lote: { findUnique: jest.fn() },
      loteModalidadePreco: { findUnique: jest.fn() },
      inscricao: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        InscricaoService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(InscricaoService);

    prisma.cliente.findUnique.mockResolvedValue({ id: clienteId, usuarioId });
    prisma.categoria.findUnique.mockResolvedValue(categoriaPadrao);
    prisma.lote.findUnique.mockResolvedValue(lotePadrao);
    prisma.loteModalidadePreco.findUnique.mockResolvedValue({
      id: 'preco-1',
      valor: '60',
    });
    prisma.inscricao.findFirst.mockResolvedValue(null);
    prisma.inscricao.create.mockResolvedValue({
      id: 'inscricao-1',
      clienteId,
      ...dto,
      status: 'PENDENTE_PAGAMENTO',
    });
  });

  describe('create', () => {
    it('lança NotFoundException se o cliente ainda não completou o perfil', async () => {
      prisma.cliente.findUnique.mockResolvedValue(null);

      await expect(service.create(usuarioId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lança NotFoundException se a categoria não existir', async () => {
      prisma.categoria.findUnique.mockResolvedValue(null);

      await expect(service.create(usuarioId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lança NotFoundException se o lote não existir', async () => {
      prisma.lote.findUnique.mockResolvedValue(null);

      await expect(service.create(usuarioId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lança BadRequestException se categoria e lote forem de eventos diferentes', async () => {
      prisma.lote.findUnique.mockResolvedValue({
        ...lotePadrao,
        eventoId: 'evento-2',
      });

      await expect(service.create(usuarioId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lança BadRequestException se o lote estiver fora da janela de venda', async () => {
      prisma.lote.findUnique.mockResolvedValue({
        ...lotePadrao,
        inicioVenda: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10),
        fimVenda: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
      });

      await expect(service.create(usuarioId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lança BadRequestException se não houver preço pra essa modalidade nesse lote', async () => {
      prisma.loteModalidadePreco.findUnique.mockResolvedValue(null);

      await expect(service.create(usuarioId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lança ConflictException se o cliente já tiver inscrição ativa nesse evento', async () => {
      prisma.inscricao.findFirst.mockResolvedValue({
        id: 'inscricao-existente',
      });

      await expect(service.create(usuarioId, dto)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.inscricao.create).not.toHaveBeenCalled();
    });

    it('cria a inscrição e retorna com o valor resolvido', async () => {
      const resultado = await service.create(usuarioId, dto);

      expect(prisma.inscricao.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            clienteId,
            categoriaId: dto.categoriaId,
            loteId: dto.loteId,
            status: 'PENDENTE_PAGAMENTO',
          }),
        }),
      );
      expect(resultado).toEqual(
        expect.objectContaining({ id: 'inscricao-1', valor: '60' }),
      );
    });
  });

  describe('findMinhas', () => {
    it('lança NotFoundException se o cliente ainda não completou o perfil', async () => {
      prisma.cliente.findUnique.mockResolvedValue(null);

      await expect(service.findMinhas(usuarioId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('retorna as inscrições do cliente', async () => {
      const inscricoes = [{ id: 'inscricao-1' }];
      prisma.inscricao.findMany.mockResolvedValue(inscricoes);

      const resultado = await service.findMinhas(usuarioId);

      expect(prisma.inscricao.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { clienteId } }),
      );
      expect(resultado).toEqual(inscricoes);
    });
  });
});
