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
        updateMany: jest.fn(),
      },
      pedido: { findUnique: jest.fn().mockResolvedValue(null) },
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
      consultarPagamento: jest.fn().mockResolvedValue(null),
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
    // `create` usa a forma em array e `confirmarPagamento` a forma com callback.
    prisma.$transaction.mockImplementation((arg: any) =>
      typeof arg === 'function'
        ? arg(prisma)
        : Promise.resolve([
            { id: 'pagamento-1', inscricaoId: inscricaoPadrao.id, status: 'PENDENTE' },
          ]),
    );
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

    it('recusa PIX quando o evento não aceita PIX', async () => {
      prisma.inscricao.findMany.mockResolvedValue([
        {
          ...inscricaoPadrao,
          categoria: {
            ...inscricaoPadrao.categoria,
            modalidade: {
              ...inscricaoPadrao.categoria.modalidade,
              evento: {
                ...inscricaoPadrao.categoria.modalidade.evento,
                aceitaPix: false,
              },
            },
          },
        },
      ]);

      await expect(service.create(usuarioId, dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(asaasService.gerarCobrancaPix).not.toHaveBeenCalled();
    });

    it('recusa cartão quando o evento não aceita cartão', async () => {
      prisma.inscricao.findMany.mockResolvedValue([
        {
          ...inscricaoPadrao,
          categoria: {
            ...inscricaoPadrao.categoria,
            modalidade: {
              ...inscricaoPadrao.categoria.modalidade,
              evento: {
                ...inscricaoPadrao.categoria.modalidade.evento,
                aceitaCartao: false,
              },
            },
          },
        },
      ]);

      await expect(
        service.create(usuarioId, {
          inscricaoId: 'inscricao-1',
          metodo: 'CARTAO_CREDITO' as const,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(asaasService.processarPagamentoCartao).not.toHaveBeenCalled();
    });

    it('repassa ao organizador o valor base menos a comissão, sem os juros do cartão', async () => {
      await service.create(usuarioId, dto);

      expect(asaasService.gerarCobrancaPix).toHaveBeenCalledWith(
        // base 60, comissão 10% => 90% do líquido para o organizador
        expect.objectContaining({ valorLiquidoOrganizador: 54 }),
      );
    });

    it('mantém o percentual do repasse independente do valor da inscrição', async () => {
      // O split e percentual sobre o liquido, entao a tarifa do gateway sai da
      // parte do organizador e o repasse combinado nao muda com o valor.
      prisma.loteModalidadePreco.findUnique.mockResolvedValue({
        id: 'preco-1',
        valor: '5.50',
      });

      await service.create(usuarioId, dto);

      expect(asaasService.gerarCobrancaPix).toHaveBeenCalledWith(
        expect.objectContaining({ valorLiquidoOrganizador: 4.95 }),
      );
    });
  });

  describe('confirmarPagamento', () => {
    const pagamentoPendente = {
      id: 'pagamento-1',
      status: 'PENDENTE',
      valor: '60',
      inscricaoId: inscricaoPadrao.id,
      pedidoId: null,
      asaasPaymentId: 'pay_asaas_123',
    };

    it('não reprocessa um pagamento já aprovado (webhook duplicado)', async () => {
      prisma.pagamento.findFirst.mockResolvedValue({
        ...pagamentoPendente,
        status: 'APROVADO',
      });

      const resultado = await service.confirmarPagamento({
        asaasPaymentId: 'pay_asaas_123',
        valorPago: 60,
        origem: 'webhook',
      });

      expect(resultado).toEqual(
        expect.objectContaining({ jaProcessado: true }),
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(emailService.enviarConfirmacaoInscricaoBatch).not.toHaveBeenCalled();
    });

    it('bloqueia a confirmação quando o valor pago é menor que o cobrado', async () => {
      prisma.pagamento.findFirst.mockResolvedValue(pagamentoPendente);

      const resultado = await service.confirmarPagamento({
        asaasPaymentId: 'pay_asaas_123',
        valorPago: 1,
        origem: 'webhook',
      });

      expect(resultado).toEqual(
        expect.objectContaining({ valorDivergente: true }),
      );
      expect(prisma.inscricao.updateMany).not.toHaveBeenCalled();
      expect(emailService.enviarConfirmacaoInscricaoBatch).not.toHaveBeenCalled();
    });

    it('aprova o pagamento, confirma a inscrição e envia os vouchers', async () => {
      prisma.pagamento.findFirst.mockResolvedValue(pagamentoPendente);
      prisma.pagamento.findUnique.mockResolvedValue({
        ...pagamentoPendente,
        status: 'APROVADO',
      });

      const resultado = await service.confirmarPagamento({
        asaasPaymentId: 'pay_asaas_123',
        valorPago: 60,
        origem: 'webhook',
      });

      expect(resultado).toEqual(
        expect.objectContaining({ confirmado: true, pagamentoId: 'pagamento-1' }),
      );
      expect(prisma.pagamento.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'APROVADO' }),
        }),
      );
      expect(prisma.inscricao.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'CONFIRMADA' },
        }),
      );
      expect(emailService.enviarConfirmacaoInscricaoBatch).toHaveBeenCalled();
      expect(notificacaoAdminService.notificarComissao).toHaveBeenCalledWith(6, 60);
    });
  });

  describe('obterStatus', () => {
    it('lança NotFoundException se o pagamento não existir', async () => {
      prisma.pagamento.findUnique.mockResolvedValue(null);

      await expect(service.obterStatus(usuarioId, 'pagamento-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lança ForbiddenException se o pagamento for de outro cliente', async () => {
      prisma.pagamento.findUnique.mockResolvedValue({
        id: 'pagamento-1',
        status: 'PENDENTE',
        inscricaoId: inscricaoPadrao.id,
        inscricao: { clienteId: 'outro-cliente' },
        pedido: null,
      });

      await expect(service.obterStatus(usuarioId, 'pagamento-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('marca como EXPIRADO um PIX vencido que o gateway não recebeu', async () => {
      asaasService.consultarPagamento = jest
        .fn()
        .mockResolvedValue({ status: 'PENDING', valor: 60 });

      prisma.pagamento.findUnique.mockResolvedValue({
        id: 'pagamento-1',
        status: 'PENDENTE',
        inscricaoId: inscricaoPadrao.id,
        inscricao: { clienteId },
        pedido: null,
        asaasPaymentId: 'pay_asaas_123',
        expiraEm: new Date(Date.now() - 1000),
      });

      await service.obterStatus(usuarioId, 'pagamento-1');

      expect(prisma.pagamento.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'EXPIRADO' },
        }),
      );
    });
  });
});
