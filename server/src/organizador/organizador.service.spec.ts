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
  let auditLog: { log: jest.Mock };

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
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
    };

    auditLog = { log: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        OrganizadorService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: auditLog },
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

  describe('atualizarInscricao: mudanca de status', () => {
    const inscricao = (extra = {}) => ({
      id: 'inscricao-1',
      categoriaId: 'categoria-1',
      status: 'PENDENTE_PAGAMENTO',
      numeroPeito: null,
      atletaNome: 'Atleta Teste',
      atletaCpf: '11122233344',
      dependenteId: null,
      dependente: null,
      cliente: { pf: { cpf: '99988877766', nomeCompleto: 'Comprador' } },
      categoria: {
        modalidade: { eventoId, evento: { organizadorId, possuiCamisa: true } },
      },
      ...extra,
    });
    const mudar = (status: any) =>
      service.atualizarInscricao(usuarioId, 'inscricao-1', { status });

    it('recusa confirmar atleta que ja esta confirmado no evento', async () => {
      prisma.inscricao.findUnique.mockResolvedValue(inscricao());
      prisma.inscricao.findFirst.mockResolvedValue({ numeroPeito: '161' });

      await expect(mudar('CONFIRMADA')).rejects.toThrow(/inscrição nº 161 confirmada/);
      expect(prisma.inscricao.update).not.toHaveBeenCalled();
      expect(auditLog.log).not.toHaveBeenCalled();

      const { where } = prisma.inscricao.findFirst.mock.calls[0][0];
      expect(where.id).toEqual({ not: 'inscricao-1' });
      expect(where.status).toBe('CONFIRMADA');
      expect(where.categoria).toEqual({ modalidade: { eventoId } });
      expect(where.OR[0]).toEqual({
        atletaCpf: { in: ['11122233344', '111.222.333-44'] },
      });
    });

    it('confirma e registra quem mudou quando nao ha outra', async () => {
      prisma.inscricao.findUnique.mockResolvedValue(inscricao());
      await mudar('CONFIRMADA');

      expect(prisma.inscricao.update).toHaveBeenCalled();
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          usuarioId,
          detalhes: expect.objectContaining({
            inscricaoId: 'inscricao-1',
            statusAnterior: 'PENDENTE_PAGAMENTO',
            statusNovo: 'CONFIRMADA',
          }),
        }),
      );
    });

    it('usa o CPF do dependente, nao o de quem comprou', async () => {
      prisma.inscricao.findUnique.mockResolvedValue(
        inscricao({ atletaCpf: null, dependenteId: 'dep-1', dependente: { cpf: '55566677788' } }),
      );
      await mudar('CONFIRMADA');

      const { where } = prisma.inscricao.findFirst.mock.calls[0][0];
      expect(where.OR[0].atletaCpf.in[0]).toBe('55566677788');
    });

    it('sem CPF nao compara e deixa confirmar', async () => {
      prisma.inscricao.findUnique.mockResolvedValue(
        inscricao({ atletaCpf: null, cliente: { pf: null } }),
      );
      await mudar('CONFIRMADA');

      expect(prisma.inscricao.findFirst).not.toHaveBeenCalled();
      expect(prisma.inscricao.update).toHaveBeenCalled();
    });

    it('cancelar a repetida nao e barrado e fica registrado', async () => {
      prisma.inscricao.findUnique.mockResolvedValue(inscricao({ status: 'CONFIRMADA' }));
      prisma.inscricao.findFirst.mockResolvedValue({ numeroPeito: '161' });
      await mudar('CANCELADA');

      expect(prisma.inscricao.update).toHaveBeenCalled();
      expect(auditLog.log).toHaveBeenCalledTimes(1);
    });

    it('salvar outros dados sem mudar o status nao confere nem registra', async () => {
      prisma.inscricao.findUnique.mockResolvedValue(inscricao({ status: 'CONFIRMADA' }));
      prisma.inscricao.findFirst.mockResolvedValue({ numeroPeito: '161' });
      await mudar('CONFIRMADA');

      expect(prisma.inscricao.update).toHaveBeenCalled();
      expect(auditLog.log).not.toHaveBeenCalled();
    });
  });

  describe('obterRelatorioFinanceiroEvento', () => {
    const insc = (nome: string, evento = eventoId) => ({
      atletaNome: nome,
      dependente: null,
      cliente: { pf: { nomeCompleto: 'Comprador' } },
      categoria: { nome: 'Geral', modalidade: { nome: '5 km', eventoId: evento } },
    });

    beforeEach(() => {
      prisma.cliente.findUnique
        .mockResolvedValueOnce({
          organizador: {
            id: organizadorId,
            clienteId: 'cliente-org',
            comissaoPercentual: 10,
            status: StatusOrganizador.APROVADO,
          },
        })
        .mockResolvedValueOnce({ pf: null, pj: { razaoSocial: 'Org LTDA', nomeFantasia: 'Corre Mais' } });
      prisma.evento.findUnique.mockResolvedValue({
        id: eventoId,
        organizadorId,
        nome: 'Corrida Teste',
        dataInicio: new Date('2026-12-01'),
        local: 'Praça',
        cidade: 'Iguatu',
        estado: 'CE',
      });
      prisma.inscricao.findMany.mockResolvedValue([
        { importacaoId: null, categoria: { modalidade: { nome: '5 km' } } },
        { importacaoId: 'imp-1', categoria: { modalidade: { nome: '5 km' } } },
      ]);
      prisma.pagamento = {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'pg-1',
            valor: 110,
            valorLiquido: 95,
            taxaGateway: null,
            comissaoPlataforma: 10,
            gateway: 'mercadopago',
            metodo: 'PIX',
            dataPagamento: new Date('2026-11-01'),
            createdAt: new Date('2026-11-01'),
            inscricao: null,
            pedido: {
              cliente: { pf: { nomeCompleto: 'Comprador' } },
              inscricoes: [insc('Ana'), insc('Bia')],
            },
          },
          {
            // Pedido de outro evento que tambem tem inscricao neste: fica fora,
            // como na tabela do financeiro.
            id: 'pg-2',
            valor: 50,
            valorLiquido: 45,
            taxaGateway: null,
            comissaoPlataforma: 5,
            gateway: 'mercadopago',
            metodo: 'CARTAO_CREDITO',
            dataPagamento: new Date('2026-11-02'),
            createdAt: new Date('2026-11-02'),
            inscricao: null,
            pedido: {
              cliente: { pf: { nomeCompleto: 'Outro' } },
              inscricoes: [insc('Caio', 'evento-2'), insc('Duda')],
            },
          },
        ]),
      };
    });

    it('soma so os pagamentos do evento e bate tarifa, comissao e liquido', async () => {
      const r = await service.obterRelatorioFinanceiroEvento(usuarioId, eventoId);

      expect(r.organizador).toBe('Corre Mais');
      expect(r.resumo).toEqual({
        quantidadePagamentos: 1,
        totalArrecadado: 110,
        taxaGateway: 5,
        comissaoPlataforma: 10,
        repasse: 95,
        inscricoesConfirmadas: 2,
      });
      expect(r.porForma).toEqual([
        { metodo: 'PIX', quantidade: 1, totalArrecadado: 110, repasse: 95 },
      ]);
      expect(r.porModalidade).toEqual([{ modalidade: '5 km', confirmadas: 2, importadas: 1 }]);
      expect(r.pagamentos[0].atletas).toEqual(['Ana', 'Bia']);
    });

    it('evento de outro organizador nao abre', async () => {
      prisma.evento.findUnique.mockResolvedValue({ id: eventoId, organizadorId: 'outro' });
      await expect(
        service.obterRelatorioFinanceiroEvento(usuarioId, eventoId),
      ).rejects.toThrow('Evento não encontrado');
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
