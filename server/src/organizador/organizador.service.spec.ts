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

  describe('criarCupom (limite por evento)', () => {
    const dtoCupom = { codigo: 'assessoria', percentualDesconto: 10 };

    beforeEach(() => {
      prisma.evento.findUnique.mockResolvedValue({
        id: eventoId,
        organizadorId,
        limiteCupons: 10,
        usosPorCupom: 1,
      });
      prisma.cupom = {
        count: jest.fn().mockResolvedValue(9),
        create: jest.fn().mockResolvedValue({ id: 'cupom-novo' }),
      };
    });

    it('cria enquanto ainda ha espaco no limite', async () => {
      await service.criarCupom(usuarioId, eventoId, dtoCupom);

      expect(prisma.cupom.count).toHaveBeenCalledWith({ where: { eventoId } });
      expect(prisma.cupom.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventoId, codigo: 'ASSESSORIA' }),
        }),
      );
    });

    it('cada cupom novo sai com os usos do evento, nao com o que o organizador mandar', async () => {
      // O painel antigo ainda mandava "limite de usos"; o whitelist descarta,
      // mas mesmo que chegasse, quem manda e o evento.
      await service.criarCupom(usuarioId, eventoId, {
        ...dtoCupom,
        quantidadeMaxima: 800,
      } as any);

      expect(prisma.cupom.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ quantidadeMaxima: 1 }),
        }),
      );
    });

    it('usa os usos por cupom que o admin liberou para o evento', async () => {
      prisma.evento.findUnique.mockResolvedValue({
        id: eventoId,
        organizadorId,
        limiteCupons: 10,
        usosPorCupom: 30,
      });

      await service.criarCupom(usuarioId, eventoId, dtoCupom);

      expect(prisma.cupom.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ quantidadeMaxima: 30 }),
        }),
      );
    });

    it('recusa quando o evento ja chegou no limite', async () => {
      prisma.cupom.count.mockResolvedValue(10);

      await expect(
        service.criarCupom(usuarioId, eventoId, dtoCupom),
      ).rejects.toThrow(/limite liberado é 10.*equipe do Seu Percurso/);
      expect(prisma.cupom.create).not.toHaveBeenCalled();
    });

    it('respeita o limite que o admin liberou para o evento', async () => {
      prisma.evento.findUnique.mockResolvedValue({
        id: eventoId,
        organizadorId,
        limiteCupons: 15,
        usosPorCupom: 1,
      });
      prisma.cupom.count.mockResolvedValue(12);

      await service.criarCupom(usuarioId, eventoId, dtoCupom);

      expect(prisma.cupom.create).toHaveBeenCalled();
    });

    it('limite 0 bloqueia qualquer cupom novo', async () => {
      prisma.evento.findUnique.mockResolvedValue({
        id: eventoId,
        organizadorId,
        limiteCupons: 0,
        usosPorCupom: 1,
      });
      prisma.cupom.count.mockResolvedValue(0);

      await expect(
        service.criarCupom(usuarioId, eventoId, dtoCupom),
      ).rejects.toThrow(BadRequestException);
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
