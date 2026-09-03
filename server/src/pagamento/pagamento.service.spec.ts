import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PagamentoService } from './pagamento.service';
import { PrismaService } from '../prisma/prisma.service';
import { GATEWAY_PAGAMENTO } from './gateway.port';
import { MercadoPagoOAuthService } from './mercadopago/mercadopago-oauth.service';
import { EmailService } from '../email/email.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { NotificacaoAdminService } from '../admin/notificacao-admin.service';
import { TarifaService } from './tarifa.service';
import { ConfigService } from '@nestjs/config';

describe('PagamentoService', () => {
  let service: PagamentoService;
  let prisma: any;
  let gateway: any;
  let mpOAuth: any;
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
          organizadorId: 'organizador-1',
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

    mpOAuth = {
      obterTokenValido: jest.fn().mockResolvedValue('TOKEN-ORG'),
      recebedorEhAPropriaPlataforma: jest.fn().mockResolvedValue(false),
    };

    gateway = {
      nome: 'mercadopago',
      gerarCobrancaPix: jest.fn().mockResolvedValue({
        gatewayPaymentId: 'mp_123',
        status: 'PENDENTE',
        pixCopiaECola: 'pix_copia_e_cola',
        pixQrCodeUrl: 'https://qr.url',
      }),
      processarPagamentoCartao: jest.fn().mockResolvedValue({
        gatewayPaymentId: 'mp_456',
        status: 'APROVADO',
      }),
      consultarCobranca: jest.fn().mockResolvedValue(null),
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
        { provide: GATEWAY_PAGAMENTO, useValue: gateway },
        { provide: MercadoPagoOAuthService, useValue: mpOAuth },
        { provide: EmailService, useValue: emailService },
        { provide: AuditLogService, useValue: auditLogService },
        { provide: NotificacaoAdminService, useValue: notificacaoAdminService },
        TarifaService,
        // Sem overrides, o TarifaService usa os padroes: PIX R$ 1,99 fixo e
        // cartao 2,99% por parcela + R$ 0,49.
        { provide: ConfigService, useValue: { get: () => undefined } },
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

    it('cria o pagamento no gateway configurado', async () => {
      const resultado = await service.create(usuarioId, dto);

      expect(prisma.pagamento.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            inscricaoId: inscricaoPadrao.id,
            // 60 de inscricao + 0,99% de tarifa de PIX, paga pelo atleta
            valor: 60.6,
            metodo: 'PIX',
            status: 'PENDENTE',
            gateway: 'mercadopago',
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
      expect(gateway.gerarCobrancaPix).not.toHaveBeenCalled();
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
      expect(gateway.processarPagamentoCartao).not.toHaveBeenCalled();
    });

    it('retém apenas a comissão da plataforma, cobrando na conta do organizador', async () => {
      await service.create(usuarioId, dto);

      expect(gateway.gerarCobrancaPix).toHaveBeenCalledWith(
        // base 60, comissão de 10% => R$ 6 para a plataforma; o restante fica
        // com o organizador, na conta dele
        expect.objectContaining({
          comissaoPlataforma: 6,
          tokenRecebedor: 'TOKEN-ORG',
        }),
      );
    });

    it('não envia comissão quando quem recebe é a própria conta da plataforma', async () => {
      mpOAuth.recebedorEhAPropriaPlataforma.mockResolvedValue(true);

      await service.create(usuarioId, dto);

      // O Mercado Pago recusa application_fee quando o recebedor e a conta dona
      // da aplicacao, e a venda inteira falha. Nao ha o que reter: o dinheiro ja
      // cai todo aqui. O atleta continua pagando o mesmo.
      expect(gateway.gerarCobrancaPix).toHaveBeenCalledWith(
        expect.objectContaining({ comissaoPlataforma: 0, valor: 60.6 }),
      );
    });

    it('recusa a cobrança quando o organizador não conectou a conta', async () => {
      mpOAuth.obterTokenValido.mockResolvedValue(null);

      await expect(service.create(usuarioId, dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(gateway.gerarCobrancaPix).not.toHaveBeenCalled();
    });

    it('cobra a tarifa do gateway do atleta, acima do valor da inscrição', async () => {
      await service.create(usuarioId, dto);

      // 60 / (1 - 0,0099): o gross-up faz sobrar exatamente 60 apos a tarifa
      expect(gateway.gerarCobrancaPix).toHaveBeenCalledWith(
        expect.objectContaining({ valor: 60.6 }),
      );
    });

    it('entrega ao organizador o mesmo valor no PIX e no cartão', async () => {
      await service.create(usuarioId, dto);
      const noPix = gateway.gerarCobrancaPix.mock.calls[0][0];

      await service.create(usuarioId, {
        inscricaoId: 'inscricao-1',
        metodo: 'CARTAO_CREDITO' as const,
        parcelas: 6,
        tokenCartao: 'tok_123',
      });
      const noCartao = gateway.processarPagamentoCartao.mock.calls[0][0];

      // O repasse nao pode depender do meio de pagamento: a tarifa e sempre do
      // atleta, entao a comissao retida e a mesma nos dois casos.
      expect(noPix.comissaoPlataforma).toBe(6);
      expect(noCartao.comissaoPlataforma).toBe(6);
      // O cartao e mais caro, entao o atleta paga mais por ele.
      expect(noCartao.valor).toBeGreaterThan(noPix.valor);
    });
  });

  describe('confirmarPagamento', () => {
    const pagamentoPendente = {
      id: 'pagamento-1',
      status: 'PENDENTE',
      valor: '60',
      inscricaoId: inscricaoPadrao.id,
      pedidoId: null,
      gatewayPaymentId: 'mp_123',
    };

    it('não reprocessa um pagamento já aprovado (webhook duplicado)', async () => {
      prisma.pagamento.findFirst.mockResolvedValue({
        ...pagamentoPendente,
        status: 'APROVADO',
      });

      const resultado = await service.confirmarPagamento({
        gatewayPaymentId: 'mp_123',
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
        gatewayPaymentId: 'mp_123',
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
        gatewayPaymentId: 'mp_123',
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
      gateway.consultarCobranca = jest
        .fn()
        .mockResolvedValue({ status: 'PENDING', valor: 60 });

      prisma.pagamento.findUnique.mockResolvedValue({
        id: 'pagamento-1',
        status: 'PENDENTE',
        inscricaoId: inscricaoPadrao.id,
        inscricao: { clienteId },
        pedido: null,
        gatewayPaymentId: 'mp_123',
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
