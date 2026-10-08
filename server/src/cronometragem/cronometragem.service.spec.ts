import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CronometragemService } from './cronometragem.service';
import { PrismaService } from '../prisma/prisma.service';
import { LicencaService } from './licenca.service';

describe('CronometragemService', () => {
  let service: CronometragemService;
  let prisma: any;
  let licenca: { garantirDisponivel: jest.Mock; emitir: jest.Mock };

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
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn((actions) => Promise.all(actions)),
    };

    licenca = {
      garantirDisponivel: jest.fn(),
      emitir: jest.fn().mockReturnValue('LICENCA-ASSINADA'),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CronometragemService,
        { provide: PrismaService, useValue: prisma },
        { provide: LicencaService, useValue: licenca },
      ],
    }).compile();

    service = moduleRef.get<CronometragemService>(CronometragemService);
  });

  describe('getConta (licença e limite de computadores do Mark)', () => {
    const maquina = 'ab'.repeat(16);
    const vence = new Date('2099-12-31T23:59:59Z');

    beforeEach(() => {
      prisma.usuarioCronometragem = {
        findUnique: jest.fn().mockResolvedValue({
          ativo: true,
          papel: 'ADMIN',
          cronometradora: {
            id: cronometradoraId,
            nome: 'Cronometra',
            status: 'ATIVA',
            plano: 'Cronometragem anual',
            assinaturaValidaAte: vence,
            limiteNotebooks: 2,
          },
          usuario: { id: userId, email: 'ana@cronometra.com', cliente: { pf: { nomeCompleto: 'Ana' } } },
        }),
      };
      prisma.notebookCronometragem = {
        findUnique: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      };
      prisma.$transaction = jest.fn((arg) =>
        typeof arg === 'function' ? arg(prisma) : Promise.all(arg),
      );
    });

    it('computador novo com vaga: registra e devolve a licença assinada', async () => {
      const conta = await service.getConta(userId, maquina.toUpperCase());

      expect(prisma.notebookCronometragem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ cronometradoraId, maquinaId: maquina, ultimoEmail: 'ana@cronometra.com' }),
      });
      expect(licenca.emitir).toHaveBeenCalledWith({
        contaId: userId,
        email: 'ana@cronometra.com',
        papel: 'admin',
        plano: 'Cronometragem anual',
        assinaturaAte: vence,
        maquinaId: maquina,
      });
      expect(conta).toMatchObject({ id: userId, papel: 'admin', licenca: 'LICENCA-ASSINADA' });
    });

    it('computador que já usa entra mesmo com o limite cheio (só atualiza o último uso)', async () => {
      prisma.notebookCronometragem.findUnique.mockResolvedValue({ id: 'nb-1', ativo: true });
      prisma.notebookCronometragem.count.mockResolvedValue(2);

      await service.getConta(userId, maquina);

      expect(prisma.notebookCronometragem.update).toHaveBeenCalledWith({
        where: { id: 'nb-1' },
        data: expect.objectContaining({ ultimoEmail: 'ana@cronometra.com' }),
      });
      expect(prisma.notebookCronometragem.create).not.toHaveBeenCalled();
    });

    it('limite cheio: computador novo é recusado e nada é gravado', async () => {
      prisma.notebookCronometragem.count.mockResolvedValue(2);

      await expect(service.getConta(userId, maquina)).rejects.toThrow(ForbiddenException);
      expect(prisma.notebookCronometragem.create).not.toHaveBeenCalled();
      expect(licenca.emitir).not.toHaveBeenCalled();
    });

    it('computador liberado antes volta a ocupar vaga, se houver', async () => {
      prisma.notebookCronometragem.findUnique.mockResolvedValue({ id: 'nb-1', ativo: false });
      prisma.notebookCronometragem.count.mockResolvedValue(1);

      await service.getConta(userId, maquina);

      expect(prisma.notebookCronometragem.update).toHaveBeenCalledWith({
        where: { id: 'nb-1' },
        data: expect.objectContaining({ ativo: true }),
      });
    });

    it('sem identificação do computador (Mark antigo ou valor estranho) recusa', async () => {
      for (const valor of [undefined, '', 'nao-hex', 'a'.repeat(31)]) {
        await expect(service.getConta(userId, valor)).rejects.toThrow(BadRequestException);
      }
      expect(prisma.notebookCronometragem.create).not.toHaveBeenCalled();
    });

    it('chave da licença não configurada: 503 e nenhum computador registrado', async () => {
      licenca.garantirDisponivel.mockImplementation(() => {
        throw new ServiceUnavailableException('indisponível');
      });

      await expect(service.getConta(userId, maquina)).rejects.toThrow(ServiceUnavailableException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('assinatura vencida continua barrando antes de tudo', async () => {
      const vinculo = await prisma.usuarioCronometragem.findUnique();
      vinculo.cronometradora.assinaturaValidaAte = new Date('2020-01-01T00:00:00Z');
      prisma.usuarioCronometragem.findUnique.mockResolvedValue(vinculo);

      await expect(service.getConta(userId, maquina)).rejects.toThrow(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
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

    it('deve checar o dono da prova antes de revelar a situação do pedido', async () => {
      prisma.solicitacaoCronometragem.findUnique.mockResolvedValue({
        id: solicitacaoId,
        eventoId,
        cronometradoraId,
        status: 'RECUSADA',
        evento: { id: eventoId, organizadorId: 'outro-org', dataFim: new Date() },
      });
      prisma.evento.findFirst.mockResolvedValue(null);

      await expect(service.aprovarSolicitacao(userId, solicitacaoId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deve aprovar e gravar auditoria com acao "APROVOU" quando PENDENTE', async () => {
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
          acao: 'APROVOU',
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

    it('deve recusar e gravar auditoria com acao "RECUSOU" quando PENDENTE', async () => {
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
          acao: 'RECUSOU',
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

    it('deve revogar e gravar auditoria com acao "REVOGOU" quando APROVADA', async () => {
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
          acao: 'REVOGOU',
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

    it('deve bloquear download se dois atletas tiverem o mesmo número de peito', async () => {
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
          numeroPeito: '150',
          categoriaId: 'cat-1',
          categoria: { modalidadeId: 'mod-1' },
          cliente: { pf: { nomeCompleto: 'Atleta 1' } },
        },
        {
          id: 'ins-2',
          numeroPeito: '150',
          categoriaId: 'cat-1',
          categoria: { modalidadeId: 'mod-1' },
          cliente: { pf: { nomeCompleto: 'Atleta 2' } },
        },
      ]);
      prisma.chipsCronometragem.findMany.mockResolvedValue([
        { numeroPeito: 150, tagEpc: 'EPC150' },
      ]);

      await expect(service.baixarInscritos(userId, cronometradoraId, eventoId)).rejects.toThrow(
        /repetidos/,
      );
    });

    it('deve liberar download sem chip, com tag nula e aviso', async () => {
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
        {
          id: 'ins-2',
          numeroPeito: '102',
          categoriaId: 'cat-1',
          categoria: { modalidadeId: 'mod-1' },
          cliente: { pf: { nomeCompleto: 'Atleta 2' } },
        },
      ]);

      // So o 101 tem chip.
      prisma.chipsCronometragem.findMany.mockResolvedValue([
        { numeroPeito: 101, tagEpc: 'EPC101' },
      ]);

      const res = await service.baixarInscritos(userId, cronometradoraId, eventoId);
      expect(res.atletas).toHaveLength(2);
      expect(res.atletas[0].tag_epc).toBe('EPC101');
      expect(res.atletas[1].tag_epc).toBeNull();
      expect(res.avisos).toEqual({ atletas_sem_chip: 1, peitos_sem_chip: [102] });
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
      expect(res.avisos).toEqual({ atletas_sem_chip: 0, peitos_sem_chip: [] });
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

    it('sem substituir, apaga so os peitos e chips enviados antes de gravar (troca de chips)', async () => {
      // Peito 101 e 102 trocam de chip: com upsert isso quebrava na regra de chip unico.
      const csv = `101,EPC002\n102,EPC001`;
      await service.importarChips(userId, eventoId, { csvContent: csv, substituir: false });

      expect(prisma.chipsCronometragem.upsert).not.toHaveBeenCalled();
      expect(prisma.chipsCronometragem.deleteMany).toHaveBeenCalledWith({
        where: {
          eventoId,
          OR: [
            { numeroPeito: { in: [101, 102] } },
            { tagEpc: { in: ['EPC002', 'EPC001'] } },
          ],
        },
      });
      expect(prisma.chipsCronometragem.createMany).toHaveBeenCalledWith({
        data: [
          { eventoId, numeroPeito: 101, tagEpc: 'EPC002' },
          { eventoId, numeroPeito: 102, tagEpc: 'EPC001' },
        ],
      });
    });
  });

  describe('enviarChips (Mark)', () => {
    const autorizar = () => {
      const futuro = new Date();
      futuro.setDate(futuro.getDate() + 5);
      prisma.solicitacaoCronometragem.findFirst.mockResolvedValue({
        id: solicitacaoId,
        status: 'APROVADA',
        validaAte: futuro,
      });
    };

    beforeEach(() => {
      prisma.inscricao.findMany.mockResolvedValue([
        { numeroPeito: '1' },
        { numeroPeito: '2' },
        { numeroPeito: '3' },
      ]);
    });

    it('recusa cronometragem sem acesso aprovado ou vencido', async () => {
      prisma.solicitacaoCronometragem.findFirst.mockResolvedValue(null);

      await expect(
        service.enviarChips(userId, cronometradoraId, eventoId, {
          chips: [{ numero_peito: 1, tag_epc: 'EPC1' }],
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.solicitacaoCronometragem.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({ status: 'APROVADA', validaAte: { gte: expect.any(Date) } }),
      });
      expect(prisma.chipsCronometragem.createMany).not.toHaveBeenCalled();
    });

    it('recusa peito que nao e de atleta confirmado', async () => {
      autorizar();

      await expect(
        service.enviarChips(userId, cronometradoraId, eventoId, {
          chips: [
            { numero_peito: 1, tag_epc: 'EPC1' },
            { numero_peito: 99, tag_epc: 'EPC99' },
          ],
        }),
      ).rejects.toThrow(/99/);
      expect(prisma.chipsCronometragem.createMany).not.toHaveBeenCalled();
    });

    it('recusa o mesmo chip em dois peitos', async () => {
      autorizar();

      await expect(
        service.enviarChips(userId, cronometradoraId, eventoId, {
          chips: [
            { numero_peito: 1, tag_epc: 'EPC1' },
            { numero_peito: 2, tag_epc: 'epc1' },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.chipsCronometragem.createMany).not.toHaveBeenCalled();
    });

    it('grava so os peitos enviados, conta quem ficou sem chip e audita', async () => {
      autorizar();
      prisma.chipsCronometragem.findMany.mockResolvedValue([
        { numeroPeito: 1 },
        { numeroPeito: 2 },
      ]);

      const res = await service.enviarChips(userId, cronometradoraId, eventoId, {
        chips: [
          { numero_peito: 1, tag_epc: ' EPC1 ' },
          { numero_peito: 2, tag_epc: 'EPC2' },
        ],
      });

      expect(res).toEqual({ gravados: 2, atletas_sem_chip: 1 });
      expect(prisma.chipsCronometragem.deleteMany).toHaveBeenCalledWith({
        where: {
          eventoId,
          OR: [
            { numeroPeito: { in: [1, 2] } },
            { tagEpc: { in: ['EPC1', 'EPC2'] } },
          ],
        },
      });
      expect(prisma.chipsCronometragem.createMany).toHaveBeenCalledWith({
        data: [
          { eventoId, numeroPeito: 1, tagEpc: 'EPC1' },
          { eventoId, numeroPeito: 2, tagEpc: 'EPC2' },
        ],
      });
      expect(prisma.auditoriaCronometragem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ acao: 'ENVIOU_CHIPS', cronometradoraId, eventoId }),
      });
    });

    it('com substituir, apaga todos os chips da prova antes', async () => {
      autorizar();

      await service.enviarChips(userId, cronometradoraId, eventoId, {
        chips: [{ numero_peito: 1, tag_epc: 'EPC1' }],
        substituir: true,
      });

      expect(prisma.chipsCronometragem.deleteMany).toHaveBeenCalledWith({ where: { eventoId } });
    });
  });

  describe('obterResumoChips', () => {
    it('conta atletas sem chip e mostra o ultimo envio da cronometragem', async () => {
      prisma.inscricao.findMany.mockResolvedValue([
        { id: 'a', numeroPeito: '1' },
        { id: 'b', numeroPeito: '2' },
        { id: 'c', numeroPeito: null },
      ]);
      prisma.chipsCronometragem.findMany.mockResolvedValue([{ numeroPeito: 1 }]);
      const quando = new Date('2026-10-01T10:00:00Z');
      prisma.auditoriaCronometragem.findFirst.mockResolvedValue({
        createdAt: quando,
        cronometradora: { nome: 'Crono Teste' },
      });

      const res = await service.obterResumoChips(userId, eventoId);

      expect(res).toEqual({
        totalChips: 1,
        totalInscritos: 3,
        inscritosComPeito: 2,
        atletasSemChip: 1,
        ultimoEnvioCronometragem: { em: quando, cronometradora: 'Crono Teste' },
      });
    });
  });
});
