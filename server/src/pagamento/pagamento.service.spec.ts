import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PagamentoService } from './pagamento.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PagamentoService', () => {
  let service: PagamentoService;
  let prisma: {
    cliente: { findUnique: jest.Mock };
    inscricao: { findUnique: jest.Mock; update: jest.Mock };
    pagamento: {
      findFirst: jest.Mock;
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    loteModalidadePreco: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };

  const usuarioId = 'usuario-1';
  const clienteId = 'cliente-1';
  const inscricaoPadrao = {
    id: 'inscricao-1',
    clienteId,
    loteId: 'lote-1',
    status: 'PENDENTE_PAGAMENTO',
    categoria: { modalidadeId: 'modalidade-1' },
  };

  beforeEach(async () => {
    prisma = {
      cliente: { findUnique: jest.fn() },
      inscricao: { findUnique: jest.fn(), update: jest.fn() },
      pagamento: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      loteModalidadePreco: { findUnique: jest.fn() },
      $transaction: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PagamentoService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(PagamentoService);

    prisma.cliente.findUnique.mockResolvedValue({ id: clienteId, usuarioId });
    prisma.inscricao.findUnique.mockResolvedValue(inscricaoPadrao);
    prisma.pagamento.findFirst.mockResolvedValue(null);
    prisma.loteModalidadePreco.findUnique.mockResolvedValue({
      id: 'preco-1',
      valor: '60',
    });
    prisma.pagamento.create.mockResolvedValue({
      id: 'pagamento-1',
      inscricaoId: inscricaoPadrao.id,
      status: 'PENDENTE',
    });
  });

  describe('create', () => {
    const dto = { inscricaoId: 'inscricao-1', metodo: 'PIX' as const };

    it('lança NotFoundException se a inscrição não existir', async () => {
      prisma.inscricao.findUnique.mockResolvedValue(null);

      await expect(service.create(usuarioId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lança ForbiddenException se a inscrição for de outro cliente', async () => {
      prisma.inscricao.findUnique.mockResolvedValue({
        ...inscricaoPadrao,
        clienteId: 'outro-cliente',
      });

      await expect(service.create(usuarioId, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('lança ConflictException se a inscrição já estiver confirmada', async () => {
      prisma.inscricao.findUnique.mockResolvedValue({
        ...inscricaoPadrao,
        status: 'CONFIRMADA',
      });

      await expect(service.create(usuarioId, dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('lança BadRequestException se a inscrição estiver cancelada', async () => {
      prisma.inscricao.findUnique.mockResolvedValue({
        ...inscricaoPadrao,
        status: 'CANCELADA',
      });

      await expect(service.create(usuarioId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lança ConflictException se já houver um pagamento aprovado', async () => {
      prisma.pagamento.findFirst.mockResolvedValue({
        id: 'pagamento-aprovado',
      });

      await expect(service.create(usuarioId, dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('cria o pagamento com o valor resolvido', async () => {
      const resultado = await service.create(usuarioId, dto);

      expect(prisma.pagamento.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            inscricaoId: inscricaoPadrao.id,
            valor: '60',
            metodo: 'PIX',
            status: 'PENDENTE',
            gateway: 'simulado',
          }),
        }),
      );
      expect(resultado).toEqual(expect.objectContaining({ id: 'pagamento-1' }));
    });
  });

  describe('simularAprovacao', () => {
    it('lança NotFoundException se o pagamento não existir', async () => {
      prisma.pagamento.findUnique.mockResolvedValue(null);

      await expect(
        service.simularAprovacao(usuarioId, 'pagamento-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('lança ForbiddenException se o pagamento for de outro cliente', async () => {
      prisma.pagamento.findUnique.mockResolvedValue({
        id: 'pagamento-1',
        status: 'PENDENTE',
        inscricaoId: inscricaoPadrao.id,
        inscricao: { clienteId: 'outro-cliente' },
      });

      await expect(
        service.simularAprovacao(usuarioId, 'pagamento-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lança BadRequestException se o pagamento já foi processado', async () => {
      prisma.pagamento.findUnique.mockResolvedValue({
        id: 'pagamento-1',
        status: 'APROVADO',
        inscricaoId: inscricaoPadrao.id,
        inscricao: { clienteId },
      });

      await expect(
        service.simularAprovacao(usuarioId, 'pagamento-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('aprova o pagamento e confirma a inscrição em uma transação', async () => {
      prisma.pagamento.findUnique.mockResolvedValue({
        id: 'pagamento-1',
        status: 'PENDENTE',
        inscricaoId: inscricaoPadrao.id,
        inscricao: { clienteId },
      });
      const pagamentoAprovado = { id: 'pagamento-1', status: 'APROVADO' };
      prisma.$transaction.mockResolvedValue([
        pagamentoAprovado,
        { id: inscricaoPadrao.id, status: 'CONFIRMADA' },
      ]);

      const resultado = await service.simularAprovacao(
        usuarioId,
        'pagamento-1',
      );

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(resultado).toEqual(pagamentoAprovado);
    });
  });
});
