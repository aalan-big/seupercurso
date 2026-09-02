import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PagamentoService } from './pagamento.service';
import { PrismaService } from '../prisma/prisma.service';
import { AsaasService } from './asaas.service';
import { EmailService } from '../email/email.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { NotificacaoAdminService } from '../admin/notificacao-admin.service';

describe('PagamentoService', () => {
  let service: PagamentoService;
  let prisma: any;
  let asaasService: any;
  let emailService: any;
  let auditLogService: any;
  let notificacaoAdminService: any;

  const usuarioId = 'usuario-1';
  const clienteId = 'cliente-1';
  const inscricaoPadrao = {
    id: 'inscricao-1',
    clienteId,
    loteId: 'lote-1',
    status: 'PENDENTE_PAGAMENTO',
    categoria: {
      modalidadeId: 'modalidade-1',
      modalidade: {
        eventoId: 'evento-1',
        evento: {
          nome: 'Corrida Teste',
          dataInicio: new Date(),
          local: 'Rua Principal',
          cidade: 'Fortaleza',
          estado: 'CE',
          organizador: { asaasWalletId: 'wal_123', comissaoPercentual: 10 },
        },
      },
    },
    cliente: {
      pf: { nomeCompleto: 'Atleta Teste', cpf: '12345678900' },
      usuario: { email: 'atleta@teste.com' },
    },
  };

  beforeEach(async () => {
    prisma = {
      cliente: { findUnique: jest.fn() },
      inscricao: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
      evento: { findUnique: jest.fn().mockResolvedValue({ aplicaDescontoIdoso: false, organizador: { asaasWalletId: 'wal_123', comissaoPercentual: 10 } }) },
      cupom: { findUnique: jest.fn().mockResolvedValue(null) },
      pagamento: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      loteModalidadePreco: { findUnique: jest.fn().mockResolvedValue({ id: 'preco-1', valor: '60' }) },
      $transaction: jest.fn(),
    };

    asaasService = {
      gerarCobrancaPix: jest.fn().mockResolvedValue({
        asaasPaymentId: 'pay_asaas_123',
        pixCopiaECola: 'pix_copia_e_cola',
        pixQrCodeUrl: 'https://qr.url',
      }),
      processarPagamentoCartao: jest.fn().mockResolvedValue({
        asaasPaymentId: 'pay_asaas_456',
        status: 'APROVADO',
      }),
    };

    emailService = {
      enviarConfirmacaoInscricaoBatch: jest.fn().mockResolvedValue(true),
    };

    auditLogService = {
      log: jest.fn(),
    };

    notificacaoAdminService = {
      notificarComissao: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PagamentoService,
        { provide: PrismaService, useValue: prisma },
        { provide: AsaasService, useValue: asaasService },
        { provide: EmailService, useValue: emailService },
        { provide: AuditLogService, useValue: auditLogService },
        { provide: NotificacaoAdminService, useValue: notificacaoAdminService },
      ],
    }).compile();

    service = moduleRef.get(PagamentoService);

    prisma.cliente.findUnique.mockResolvedValue({ id: clienteId, usuarioId });
    prisma.inscricao.findMany.mockResolvedValue([inscricaoPadrao]);
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
    prisma.$transaction.mockResolvedValue([
      { id: 'pagamento-1', inscricaoId: inscricaoPadrao.id, status: 'PENDENTE' },
    ]);
  });

  describe('create', () => {
    const dto = { inscricaoId: 'inscricao-1', metodo: 'PIX' as const };

    it('lança NotFoundException se a inscrição não existir', async () => {
      prisma.inscricao.findMany.mockResolvedValue([]);

      await expect(service.create(usuarioId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lança ConflictException se a inscrição já estiver confirmada', async () => {
      prisma.inscricao.findMany.mockResolvedValue([
        {
          ...inscricaoPadrao,
          status: 'CONFIRMADA',
        },
      ]);

      await expect(service.create(usuarioId, dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('cria o pagamento com o gateway asaas', async () => {
      const resultado = await service.create(usuarioId, dto);

      expect(prisma.pagamento.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            inscricaoId: inscricaoPadrao.id,
            valor: 60,
            metodo: 'PIX',
            status: 'PENDENTE',
            gateway: 'asaas',
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
      const pagamentoAprovado = { id: 'pagamento-1', status: 'APROVADO' };
      prisma.pagamento.findUnique
        .mockResolvedValueOnce({
          id: 'pagamento-1',
          status: 'PENDENTE',
          inscricaoId: inscricaoPadrao.id,
          inscricao: { clienteId },
        })
        .mockResolvedValueOnce(pagamentoAprovado);

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
