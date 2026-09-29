import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CronometragemService } from './cronometragem.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CronometragemService', () => {
  let service: CronometragemService;
  let prisma: any;

  const userId = 'user-1';
  const cronometradoraId = 'crono-1';
  const eventoId = 'evento-1';
  const solicitacaoId = 'sol-1';

  beforeEach(async () => {
    prisma = {
      cliente: {
        findUnique: jest.fn().mockResolvedValue({
          organizador: { id: 'org-1', status: 'APROVADO' },
        }),
      },
      evento: {
        findUnique: jest.fn().mockResolvedValue({
          id: eventoId,
          nome: 'Corrida Teste',
          dataInicio: new Date('2026-10-10T08:00:00Z'),
          dataFim: new Date('2026-10-10T12:00:00Z'),
          organizadorId: 'org-1',
          modalidades: [
            {
              id: 'mod-1',
              nome: '5K',
              distanciaKm: 5,
              categorias: [{ id: 'cat-1', nome: 'Geral', genero: 'MASCULINO', idadeMinima: 18, idadeMaxima: 99 }],
            },
          ],
        }),
        findFirst: jest.fn().mockResolvedValue({
          id: eventoId,
          nome: 'Corrida Teste',
          organizadorId: 'org-1',
        }),
      },
      solicitacaoCronometragem: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      inscricao: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      chipsCronometragem: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        upsert: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(0),
      },
      auditoriaCronometragem: {
        create: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn((actions) => Promise.all(actions)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CronometragemService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get<CronometragemService>(CronometragemService);
  });

  describe('aprovarSolicitacao', () => {
    it('deve lançar ConflictException se o status não for PENDENTE', async () => {
      prisma.solicitacaoCronometragem.findUnique.mockResolvedValue({
        id: solicitacaoId,
        eventoId,
        cronometradoraId,
        status: 'RECUSADA',
        evento: { id: eventoId, organizadorId: 'org-1', dataFim: new Date() },
      });

      await expect(service.aprovarSolicitacao(userId, solicitacaoId)).rejects.toThrow(
        ConflictException,
      );
    });

    it('deve aprovar e gravar auditoria com acao "aprovou" quando PENDENTE', async () => {
      prisma.solicitacaoCronometragem.findUnique.mockResolvedValue({
        id: solicitacaoId,
        eventoId,
        cronometradoraId,
        status: 'PENDENTE',
        evento: { id: eventoId, organizadorId: 'org-1', dataFim: new Date('2026-10-10') },
      });
      prisma.solicitacaoCronometragem.update.mockResolvedValue({
        id: solicitacaoId,
        status: 'APROVADA',
      });

      const res = await service.aprovarSolicitacao(userId, solicitacaoId);
      expect(res.status).toBe('APROVADA');
      expect(prisma.auditoriaCronometragem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          usuarioId: userId,
          cronometradoraId,
          eventoId,
          acao: 'aprovou',
        }),
      });
    });
  });

  describe('recusarSolicitacao', () => {
    it('deve lançar ConflictException se o status não for PENDENTE', async () => {
      prisma.solicitacaoCronometragem.findUnique.mockResolvedValue({
        id: solicitacaoId,
        eventoId,
        cronometradoraId,
        status: 'APROVADA',
        evento: { id: eventoId, organizadorId: 'org-1' },
      });

      await expect(service.recusarSolicitacao(userId, solicitacaoId, 'Motivo')).rejects.toThrow(
        ConflictException,
      );
    });

    it('deve recusar e gravar auditoria com acao "recusou" quando PENDENTE', async () => {
      prisma.solicitacaoCronometragem.findUnique.mockResolvedValue({
        id: solicitacaoId,
        eventoId,
        cronometradoraId,
        status: 'PENDENTE',
        evento: { id: eventoId, organizadorId: 'org-1' },
      });
      prisma.solicitacaoCronometragem.update.mockResolvedValue({
        id: solicitacaoId,
        status: 'RECUSADA',
      });

      const res = await service.recusarSolicitacao(userId, solicitacaoId, 'Empresa desconhecida');
      expect(res.status).toBe('RECUSADA');
      expect(prisma.auditoriaCronometragem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          acao: 'recusou',
        }),
      });
    });
  });

  describe('revogarSolicitacao', () => {
    it('deve lançar ConflictException se o status não for APROVADA', async () => {
      prisma.solicitacaoCronometragem.findUnique.mockResolvedValue({
        id: solicitacaoId,
        eventoId,
        cronometradoraId,
        status: 'PENDENTE',
        evento: { id: eventoId, organizadorId: 'org-1' },
      });

      await expect(service.revogarSolicitacao(userId, solicitacaoId)).rejects.toThrow(
        ConflictException,
      );
    });

    it('deve revogar e gravar auditoria com acao "revogou" quando APROVADA', async () => {
      prisma.solicitacaoCronometragem.findUnique.mockResolvedValue({
        id: solicitacaoId,
        eventoId,
        cronometradoraId,
        status: 'APROVADA',
        evento: { id: eventoId, organizadorId: 'org-1' },
      });
      prisma.solicitacaoCronometragem.update.mockResolvedValue({
        id: solicitacaoId,
        status: 'REVOGADA',
      });

      const res = await service.revogarSolicitacao(userId, solicitacaoId);
      expect(res.status).toBe('REVOGADA');
      expect(prisma.auditoriaCronometragem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          acao: 'revogou',
        }),
      });
    });
  });

  describe('baixarInscritos', () => {
    it('deve recusar download se a autorização estiver expirada ou não for aprovada', async () => {
      prisma.solicitacaoCronometragem.findFirst.mockResolvedValue(null);

      await expect(service.baixarInscritos(userId, cronometradoraId, eventoId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('deve bloquear download se houver atleta confirmado sem número de peito', async () => {
      const futuro = new Date();
      futuro.setDate(futuro.getDate() + 5);
      prisma.solicitacaoCronometragem.findFirst.mockResolvedValue({
        id: solicitacaoId,
        status: 'APROVADA',
        validaAte: futuro,
      });

      prisma.inscricao.findMany.mockResolvedValue([
        {
          id: 'ins-1',
          numeroPeito: null, // SEM PEITO
          categoriaId: 'cat-1',
          categoria: { modalidadeId: 'mod-1' },
          cliente: { pf: { nomeCompleto: 'Atleta 1' } },
        },
      ]);

      await expect(service.baixarInscritos(userId, cronometradoraId, eventoId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('deve bloquear download se houver atleta sem chip cadastrado', async () => {
      const futuro = new Date();
      futuro.setDate(futuro.getDate() + 5);
      prisma.solicitacaoCronometragem.findFirst.mockResolvedValue({
        id: solicitacaoId,
        status: 'APROVADA',
        validaAte: futuro,
      });

      prisma.inscricao.findMany.mockResolvedValue([
        {
          id: 'ins-1',
          numeroPeito: '101',
          categoriaId: 'cat-1',
          categoria: { modalidadeId: 'mod-1' },
          cliente: { pf: { nomeCompleto: 'Atleta 1' } },
        },
      ]);

      // Nenhum chip na tabela ChipsCronometragem
      prisma.chipsCronometragem.findMany.mockResolvedValue([]);

      await expect(service.baixarInscritos(userId, cronometradoraId, eventoId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('deve baixar inscritos com sucesso quando todos tiverem peito e chip', async () => {
      const futuro = new Date();
      futuro.setDate(futuro.getDate() + 5);
      prisma.solicitacaoCronometragem.findFirst.mockResolvedValue({
        id: solicitacaoId,
        status: 'APROVADA',
        validaAte: futuro,
      });

      prisma.inscricao.findMany.mockResolvedValue([
        {
          id: 'ins-1',
          numeroPeito: '101',
          categoriaId: 'cat-1',
          categoria: { modalidadeId: 'mod-1' },
          cliente: { pf: { nomeCompleto: 'Atleta 1' } },
        },
      ]);

      prisma.chipsCronometragem.findMany.mockResolvedValue([
        {
          numeroPeito: 101,
          tagEpc: 'EPC101TESTE',
        },
      ]);

      const res = await service.baixarInscritos(userId, cronometradoraId, eventoId);
      expect(res.atletas).toHaveLength(1);
      expect(res.atletas[0].numero_peito).toBe(101);
      expect(res.atletas[0].tag_epc).toBe('EPC101TESTE');
      expect(prisma.auditoriaCronometragem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          acao: 'BAIXOU_INSCRITOS',
        }),
      });
    });
  });

  describe('importarChips', () => {
    it('deve validar e importar chips com sucesso', async () => {
      const csv = `numero_peito,tag_epc\n101,EPC001\n102,EPC002`;
      const res = await service.importarChips(userId, eventoId, {
        csvContent: csv,
        substituir: true,
      });

      expect(res.sucesso).toBe(true);
      expect(res.totalProcessados).toBe(2);
      expect(prisma.chipsCronometragem.deleteMany).toHaveBeenCalledWith({ where: { eventoId } });
      expect(prisma.chipsCronometragem.createMany).toHaveBeenCalledWith({
        data: [
          { eventoId, numeroPeito: 101, tagEpc: 'EPC001' },
          { eventoId, numeroPeito: 102, tagEpc: 'EPC002' },
        ],
      });
    });

    it('deve rejeitar se houver número de peito duplicado no CSV', async () => {
      const csv = `numero_peito,tag_epc\n101,EPC001\n101,EPC002`;
      await expect(
        service.importarChips(userId, eventoId, {
          csvContent: csv,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
