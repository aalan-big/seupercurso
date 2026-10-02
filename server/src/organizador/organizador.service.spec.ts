import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { OrganizadorService } from './organizador.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { MercadoPagoOAuthService } from '../pagamento/mercadopago/mercadopago-oauth.service';
import { EmailService } from '../email/email.service';
import { StatusOrganizador } from '../generated/prisma/enums';
import { Prisma } from '../generated/prisma/client';

describe('OrganizadorService', () => {
  let service: OrganizadorService;
  let prisma: any;

  const usuarioId = 'usuario-1';
  const organizadorId = 'organizador-1';
  const eventoId = 'evento-1';

  beforeEach(async () => {
    prisma = {
      cliente: {
        findUnique: jest.fn().mockResolvedValue({
          organizador: { id: organizadorId, status: StatusOrganizador.APROVADO },
        }),
      },
      evento: {
        findUnique: jest.fn().mockResolvedValue({
          id: eventoId,
          organizadorId,
          camisaOpcional: true,
        }),
      },
      modeloCamisa: {
        findFirst: jest.fn(),
        delete: jest.fn().mockResolvedValue({ id: 'modelo-1' }),
      },
      categoria: { findFirst: jest.fn() },
      inscricao: {
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        OrganizadorService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: { log: jest.fn() } },
        { provide: MercadoPagoOAuthService, useValue: {} },
        { provide: EmailService, useValue: {} },
      ],
    }).compile();

    service = moduleRef.get(OrganizadorService);
  });

  describe('cupons', () => {
    const dtoCupom = { codigo: 'assessoria', percentualDesconto: 10 };

    beforeEach(() => {
      prisma.cupom = {
        count: jest.fn().mockResolvedValue(500),
        create: jest.fn().mockResolvedValue({ id: 'cupom-novo' }),
        findUnique: jest.fn(),
        delete: jest.fn().mockResolvedValue({ id: 'cupom-1' }),
      };
    });

    it('cria sem limite de cupons por evento', async () => {
      await service.criarCupom(usuarioId, eventoId, dtoCupom);

      expect(prisma.cupom.count).not.toHaveBeenCalled();
      expect(prisma.cupom.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventoId, codigo: 'ASSESSORIA' }),
        }),
      );
    });

    it('usa o limite de usos que o organizador escolheu', async () => {
      await service.criarCupom(usuarioId, eventoId, { ...dtoCupom, quantidadeMaxima: 30 });

      expect(prisma.cupom.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ quantidadeMaxima: 30 }),
        }),
      );
    });

    it('sem limite de usos informado, o cupom fica sem limite', async () => {
      await service.criarCupom(usuarioId, eventoId, dtoCupom);

      const data = prisma.cupom.create.mock.calls[0][0].data;
      expect(data.quantidadeMaxima).toBeUndefined();
    });

    it('nao deixa remover cupom bloqueado pelo admin', async () => {
      prisma.cupom.findUnique.mockResolvedValue({ id: 'cupom-1', eventoId, ativo: false });

      await expect(
        service.removerCupom(usuarioId, eventoId, 'cupom-1'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.cupom.delete).not.toHaveBeenCalled();
    });

    it('remove cupom ativo', async () => {
      prisma.cupom.findUnique.mockResolvedValue({ id: 'cupom-1', eventoId, ativo: true });

      await service.removerCupom(usuarioId, eventoId, 'cupom-1');

      expect(prisma.cupom.delete).toHaveBeenCalledWith({ where: { id: 'cupom-1' } });
    });
  });

  describe('remover lote/modalidade com inscricao', () => {
    const erroFk = () =>
      new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
        code: 'P2003',
        clientVersion: 'test',
      });

    beforeEach(() => {
      prisma.lote = {
        findUnique: jest.fn().mockResolvedValue({ id: 'lote-1', eventoId }),
        delete: jest.fn().mockReturnValue('op-delete-lote'),
      };
      prisma.modalidade = {
        findUnique: jest.fn().mockResolvedValue({ id: 'mod-1', eventoId }),
        delete: jest.fn().mockReturnValue('op-delete-modalidade'),
      };
      prisma.loteModalidadePreco = { deleteMany: jest.fn().mockReturnValue('op-delete-precos') };
      prisma.categoria.deleteMany = jest.fn().mockReturnValue('op-delete-categorias');
      prisma.$transaction = jest.fn();
    });

    it('lote: apaga precos e lote na mesma transacao', async () => {
      prisma.$transaction.mockResolvedValue([{ count: 1 }, { id: 'lote-1' }]);

      const res = await service.removerLote(usuarioId, eventoId, 'lote-1');

      expect(prisma.$transaction).toHaveBeenCalledWith(['op-delete-precos', 'op-delete-lote']);
      expect(res).toEqual({ id: 'lote-1' });
    });

    it('lote com inscricao: recusa e nao apaga o preco fora da transacao', async () => {
      prisma.$transaction.mockRejectedValue(erroFk());

      await expect(service.removerLote(usuarioId, eventoId, 'lote-1')).rejects.toThrow(
        ConflictException,
      );
      // deleteMany so monta a operacao; quem executa e a transacao, que falhou inteira
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('modalidade com inscricao: recusa sem apagar precos nem categorias', async () => {
      prisma.$transaction.mockRejectedValue(erroFk());

      await expect(service.removerModalidade(usuarioId, eventoId, 'mod-1')).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.$transaction).toHaveBeenCalledWith([
        'op-delete-precos',
        'op-delete-categorias',
        'op-delete-modalidade',
      ]);
    });
  });

  describe('deletarModeloCamisa', () => {
    beforeEach(() => {
      prisma.modeloCamisa.findFirst.mockResolvedValue({
        id: 'modelo-1',
        nome: 'Azul',
        fotoFrenteUrl: null,
        fotoVersoUrl: null,
      });
    });

    it('recusa excluir modelo que atletas ja escolheram', async () => {
      prisma.inscricao.count.mockResolvedValue(3);

      await expect(
        service.deletarModeloCamisa(usuarioId, eventoId, 'modelo-1'),
      ).rejects.toThrow(ConflictException);
      expect(prisma.modeloCamisa.delete).not.toHaveBeenCalled();
    });

    it('exclui modelo que ninguem escolheu', async () => {
      await service.deletarModeloCamisa(usuarioId, eventoId, 'modelo-1');

      expect(prisma.modeloCamisa.delete).toHaveBeenCalledWith({
        where: { id: 'modelo-1' },
      });
    });
  });

  describe('atualizarInscricao', () => {
    beforeEach(() => {
      prisma.inscricao.findUnique.mockResolvedValue({
        id: 'inscricao-1',
        categoriaId: 'categoria-1',
        categoria: {
          modalidade: {
            eventoId,
            evento: { organizadorId, possuiCamisa: true },
          },
        },
      });
    });

    it('recusa mover a inscricao para categoria de outro evento', async () => {
      prisma.categoria.findFirst.mockResolvedValue(null);

      await expect(
        service.atualizarInscricao(usuarioId, 'inscricao-1', {
          categoriaId: 'categoria-de-outro-evento',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.inscricao.update).not.toHaveBeenCalled();
    });

    it('recusa modelo de camisa de outro evento', async () => {
      prisma.modeloCamisa.findFirst.mockResolvedValue(null);

      await expect(
        service.atualizarInscricao(usuarioId, 'inscricao-1', {
          modeloCamisaId: 'modelo-de-outro-evento',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.inscricao.update).not.toHaveBeenCalled();
    });
  });

  describe('obterKits', () => {
    it('quem ficou sem camisa nao entra na grade de tamanhos a produzir', async () => {
      prisma.inscricao.findMany.mockResolvedValue([
        {
          tamanhoCamisa: 'M',
          incluiCamisa: true,
          modeloCamisa: null,
          categoria: { modalidade: { id: 'mod-1', nome: '5KM' } },
        },
        {
          tamanhoCamisa: null,
          incluiCamisa: false,
          modeloCamisa: null,
          categoria: { modalidade: { id: 'mod-1', nome: '5KM' } },
        },
      ]);

      const kits = await service.obterKits(usuarioId, eventoId);

      expect(kits.totalPorTamanho).toEqual({ M: 1 });
      expect(kits.totalComCamisa).toBe(1);
      expect(kits.totalSemCamisa).toBe(1);
    });
  });
});
