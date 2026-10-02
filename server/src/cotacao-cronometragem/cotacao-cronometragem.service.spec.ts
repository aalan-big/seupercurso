import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  CotacaoCronometragemService,
  fimDoDiaBrasilia,
  situacaoCotacao,
} from './cotacao-cronometragem.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { NotificacaoAdminService } from '../admin/notificacao-admin.service';
import { StatusCotacaoCronometragem as S } from '../generated/prisma/enums';

const DIA = 24 * 60 * 60 * 1000;
const futuro = (dias: number) => new Date(Date.now() + dias * DIA);
const isoData = (d: Date) => d.toISOString().slice(0, 10);

describe('CotacaoCronometragemService', () => {
  let service: CotacaoCronometragemService;
  let prisma: any;
  let tx: any;
  let email: { enviarAvisoCotacaoCronometragem: jest.Mock };
  let push: { enviarPushParaTodos: jest.Mock };

  const usuarioId = 'usuario-1';
  const organizadorId = 'org-1';
  const eventoId = 'evento-1';

  const evento = {
    id: eventoId,
    nome: 'Corrida Teste',
    organizadorId,
    status: 'PUBLICADO',
    dataInicio: futuro(30),
    dataFim: futuro(30),
  };

  const cotacaoAdmin = (status: S, extra: Record<string, unknown> = {}) => ({
    id: 'cot-1',
    eventoId,
    organizadorId,
    status,
    propostaValidaAte: null,
    evento: { ...evento },
    organizador: {
      id: organizadorId,
      cliente: {
        usuario: { email: 'org@teste.com' },
        pf: { nomeCompleto: 'Organizadora', celular: null },
        pj: null,
      },
    },
    ...extra,
  });

  beforeEach(async () => {
    tx = {
      cotacaoCronometragem: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      solicitacaoCronometragem: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
    };

    prisma = {
      cliente: {
        findUnique: jest.fn().mockResolvedValue({
          organizador: { id: organizadorId, status: 'APROVADO' },
        }),
      },
      evento: { findUnique: jest.fn().mockResolvedValue(evento) },
      cotacaoCronometragem: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn().mockResolvedValue(cotacaoAdmin(S.ORCADA)),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: 'cot-1', propostaValidaAte: null, status: S.SOLICITADA, evento, ...data }),
        ),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      configuracaoPlataforma: {
        findUnique: jest.fn().mockResolvedValue({ dadosPagamentoCronometragem: 'PIX: 123' }),
      },
      cronometradora: { findUnique: jest.fn().mockResolvedValue({ id: 'crono-1' }) },
      inscricao: { count: jest.fn().mockResolvedValue(42) },
      $transaction: jest.fn((fn: any) => fn(tx)),
    };

    email = { enviarAvisoCotacaoCronometragem: jest.fn().mockResolvedValue({ enviado: true }) };
    push = { enviarPushParaTodos: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CotacaoCronometragemService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailService, useValue: email },
        { provide: NotificacaoAdminService, useValue: push },
      ],
    }).compile();

    service = moduleRef.get(CotacaoCronometragemService);
  });

  describe('solicitar', () => {
    const dto = { servicos: ['CHIP', 'TAPETE'], atletasEstimados: 300 };

    it('cria a cotacao e avisa o admin', async () => {
      const res = await service.solicitar(usuarioId, eventoId, dto);

      expect(prisma.cotacaoCronometragem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventoId, organizadorId, servicos: ['CHIP', 'TAPETE'] }),
        }),
      );
      expect(res.situacao).toBe(S.SOLICITADA);
      expect(push.enviarPushParaTodos).toHaveBeenCalled();
    });

    it('nao deixa pedir para evento de outro organizador', async () => {
      prisma.evento.findUnique.mockResolvedValue({ ...evento, organizadorId: 'outro' });

      await expect(service.solicitar(usuarioId, eventoId, dto)).rejects.toThrow(NotFoundException);
      expect(prisma.cotacaoCronometragem.create).not.toHaveBeenCalled();
    });

    it('organizador nao aprovado nao pede', async () => {
      prisma.cliente.findUnique.mockResolvedValue({
        organizador: { id: organizadorId, status: 'PENDENTE' },
      });

      await expect(service.solicitar(usuarioId, eventoId, dto)).rejects.toThrow(ForbiddenException);
    });

    it('recusa evento que ja aconteceu', async () => {
      prisma.evento.findUnique.mockResolvedValue({ ...evento, dataFim: futuro(-1) });

      await expect(service.solicitar(usuarioId, eventoId, dto)).rejects.toThrow(BadRequestException);
    });

    it('recusa evento cancelado', async () => {
      prisma.evento.findUnique.mockResolvedValue({ ...evento, status: 'CANCELADO' });

      await expect(service.solicitar(usuarioId, eventoId, dto)).rejects.toThrow(BadRequestException);
    });

    it('so uma cotacao aberta por evento', async () => {
      prisma.cotacaoCronometragem.findFirst.mockResolvedValue({ id: 'aberta' });

      await expect(service.solicitar(usuarioId, eventoId, dto)).rejects.toThrow(ConflictException);
      expect(prisma.cotacaoCronometragem.create).not.toHaveBeenCalled();
    });

    it('aviso que falha nao derruba o pedido', async () => {
      push.enviarPushParaTodos.mockRejectedValue(new Error('sem rede'));

      await expect(service.solicitar(usuarioId, eventoId, dto)).resolves.toBeDefined();
    });
  });

  describe('organizador respondendo a proposta', () => {
    beforeEach(() => {
      prisma.cotacaoCronometragem.findUnique.mockResolvedValue(
        cotacaoAdmin(S.ORCADA, { propostaValidaAte: futuro(3) }),
      );
    });

    it('aceita so proposta orcada e dentro da validade', async () => {
      await service.aceitar(usuarioId, 'cot-1');

      expect(prisma.cotacaoCronometragem.updateMany).toHaveBeenCalledWith({
        where: { id: 'cot-1', status: S.ORCADA, propostaValidaAte: { gte: expect.any(Date) } },
        data: { status: S.ACEITA, aceitaEm: expect.any(Date) },
      });
    });

    it('proposta vencida nao e aceita', async () => {
      prisma.cotacaoCronometragem.findUnique.mockResolvedValue(
        cotacaoAdmin(S.ORCADA, { propostaValidaAte: futuro(-1) }),
      );
      prisma.cotacaoCronometragem.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.aceitar(usuarioId, 'cot-1')).rejects.toThrow(/venceu/);
    });

    it('nao mexe em cotacao de outro organizador', async () => {
      prisma.cotacaoCronometragem.findUnique.mockResolvedValue(
        cotacaoAdmin(S.ORCADA, { organizadorId: 'outro' }),
      );

      await expect(service.aceitar(usuarioId, 'cot-1')).rejects.toThrow(NotFoundException);
      await expect(service.cancelarPeloOrganizador(usuarioId, 'cot-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.cotacaoCronometragem.updateMany).not.toHaveBeenCalled();
    });

    it('nao cancela pelo painel depois de paga', async () => {
      prisma.cotacaoCronometragem.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.cancelarPeloOrganizador(usuarioId, 'cot-1')).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.cotacaoCronometragem.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cot-1', status: { in: [S.SOLICITADA, S.ORCADA, S.ACEITA] } },
        }),
      );
    });

    it('comprovante so com proposta aceita', async () => {
      await service.enviarComprovante(usuarioId, 'cot-1', '/uploads/cronometragem/c.pdf');

      expect(prisma.cotacaoCronometragem.updateMany).toHaveBeenCalledWith({
        where: { id: 'cot-1', status: S.ACEITA },
        data: { comprovanteUrl: '/uploads/cronometragem/c.pdf', comprovanteEnviadoEm: expect.any(Date) },
      });
    });
  });

  describe('listarMinhas', () => {
    it('dados de pagamento so na cotacao aceita', async () => {
      prisma.cotacaoCronometragem.findMany.mockResolvedValue([
        { id: 'a', status: S.ACEITA, propostaValidaAte: futuro(1) },
        { id: 'b', status: S.ORCADA, propostaValidaAte: futuro(1) },
      ]);

      const res = await service.listarMinhas(usuarioId);

      expect(res.find((c) => c.id === 'a')?.dadosPagamento).toBe('PIX: 123');
      expect(res.find((c) => c.id === 'b')?.dadosPagamento).toBeNull();
    });
  });

  describe('admin', () => {
    it('envia proposta e avisa o organizador por e-mail', async () => {
      prisma.cotacaoCronometragem.findUnique.mockResolvedValue(cotacaoAdmin(S.SOLICITADA));

      await service.enviarProposta('cot-1', {
        valor: 1500,
        descricao: 'Chip, tapete e resultado online',
        propostaValidaAte: isoData(futuro(5)),
        pagamentoAte: isoData(futuro(10)),
      });

      expect(prisma.cotacaoCronometragem.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cot-1', status: { in: [S.SOLICITADA, S.ORCADA] } },
          data: expect.objectContaining({ status: S.ORCADA, valor: 1500 }),
        }),
      );
      expect(email.enviarAvisoCotacaoCronometragem).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'org@teste.com', tipo: 'PROPOSTA', valor: 1500 }),
      );
    });

    it('recusa validade no passado e pagamento antes da validade', async () => {
      prisma.cotacaoCronometragem.findUnique.mockResolvedValue(cotacaoAdmin(S.SOLICITADA));
      const base = { valor: 100, descricao: 'abc' };

      await expect(
        service.enviarProposta('cot-1', {
          ...base,
          propostaValidaAte: isoData(futuro(-2)),
          pagamentoAte: isoData(futuro(5)),
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.enviarProposta('cot-1', {
          ...base,
          propostaValidaAte: isoData(futuro(10)),
          pagamentoAte: isoData(futuro(5)),
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.cotacaoCronometragem.updateMany).not.toHaveBeenCalled();
    });

    it('confirma pagamento e libera a cronometradora na prova', async () => {
      prisma.cotacaoCronometragem.findUnique.mockResolvedValue(cotacaoAdmin(S.ACEITA));

      await service.confirmarPagamento('cot-1', 'crono-1');

      expect(tx.cotacaoCronometragem.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'cot-1', status: S.ACEITA } }),
      );
      const criada = tx.solicitacaoCronometragem.create.mock.calls[0][0].data;
      expect(criada).toEqual(
        expect.objectContaining({ cronometradoraId: 'crono-1', eventoId, status: 'APROVADA' }),
      );
      expect(criada.validaAte.getTime()).toBe(evento.dataFim.getTime() + 7 * DIA);
      expect(email.enviarAvisoCotacaoCronometragem).toHaveBeenCalledWith(
        expect.objectContaining({ tipo: 'PAGAMENTO_CONFIRMADO' }),
      );
    });

    it('pedido de acesso pendente da mesma cronometradora vira aprovado', async () => {
      prisma.cotacaoCronometragem.findUnique.mockResolvedValue(cotacaoAdmin(S.ACEITA));
      tx.solicitacaoCronometragem.findFirst.mockResolvedValue({
        id: 'sol-1',
        status: 'PENDENTE',
        respondidaEm: null,
        validaAte: null,
      });

      await service.confirmarPagamento('cot-1', 'crono-1');

      expect(tx.solicitacaoCronometragem.create).not.toHaveBeenCalled();
      expect(tx.solicitacaoCronometragem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sol-1' },
          data: expect.objectContaining({ status: 'APROVADA' }),
        }),
      );
    });

    it('sem cronometradora nao cria acesso', async () => {
      prisma.cotacaoCronometragem.findUnique.mockResolvedValue(cotacaoAdmin(S.ACEITA));

      await service.confirmarPagamento('cot-1');

      expect(tx.solicitacaoCronometragem.findFirst).not.toHaveBeenCalled();
      expect(tx.solicitacaoCronometragem.create).not.toHaveBeenCalled();
    });

    it('nao confirma pagamento de proposta que nao foi aceita', async () => {
      prisma.cotacaoCronometragem.findUnique.mockResolvedValue(cotacaoAdmin(S.ORCADA));
      tx.cotacaoCronometragem.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.confirmarPagamento('cot-1', 'crono-1')).rejects.toThrow(
        ConflictException,
      );
      expect(tx.solicitacaoCronometragem.create).not.toHaveBeenCalled();
      expect(email.enviarAvisoCotacaoCronometragem).not.toHaveBeenCalled();
    });

    it('nao cancela cotacao paga', async () => {
      prisma.cotacaoCronometragem.findUnique.mockResolvedValue(cotacaoAdmin(S.PAGA));
      prisma.cotacaoCronometragem.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.cancelarPelaEquipe('cot-1', 'motivo')).rejects.toThrow(
        ConflictException,
      );
      expect(email.enviarAvisoCotacaoCronometragem).not.toHaveBeenCalled();
    });

    it('e-mail que falha nao derruba a proposta', async () => {
      prisma.cotacaoCronometragem.findUnique.mockResolvedValue(cotacaoAdmin(S.SOLICITADA));
      email.enviarAvisoCotacaoCronometragem.mockRejectedValue(new Error('resend fora'));

      await expect(
        service.enviarProposta('cot-1', {
          valor: 100,
          descricao: 'abc',
          propostaValidaAte: isoData(futuro(2)),
          pagamentoAte: isoData(futuro(2)),
        }),
      ).resolves.toBeDefined();
    });
  });

  describe('apoio', () => {
    it('proposta vencida aparece como expirada', () => {
      expect(situacaoCotacao({ status: S.ORCADA, propostaValidaAte: futuro(-1) })).toBe('EXPIRADA');
      expect(situacaoCotacao({ status: S.ORCADA, propostaValidaAte: futuro(1) })).toBe(S.ORCADA);
      expect(situacaoCotacao({ status: S.PAGA, propostaValidaAte: futuro(-1) })).toBe(S.PAGA);
    });

    it('data vale ate o fim do dia em Brasilia', () => {
      expect(fimDoDiaBrasilia('2026-10-20').toISOString()).toBe('2026-10-21T02:59:59.000Z');
      expect(() => fimDoDiaBrasilia('2026-13-45')).toThrow(BadRequestException);
    });
  });
});
