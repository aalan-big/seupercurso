import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { InscricaoService } from './inscricao.service';
import { PrismaService } from '../prisma/prisma.service';
import { StatusInscricao } from '../generated/prisma/enums';

describe('InscricaoService', () => {
  let service: InscricaoService;
  let prisma: any;
  let tx: any;

  const usuarioId = 'usuario-1';
  const clienteId = 'cliente-1';
  const eventoId = 'evento-1';
  const dto = { categoriaId: 'categoria-1', loteId: 'lote-1' };

  const dataEvento = new Date('2026-12-01');

  // Categoria sem restricao: idade, genero e PCD livres, e sem limite de vagas.
  // Cada teste aperta so o que quer verificar.
  const categoriaPadrao = {
    id: 'categoria-1',
    modalidadeId: 'modalidade-1',
    capacidade: null,
    idadeMinima: null,
    idadeMaxima: null,
    genero: 'LIVRE',
    pcd: false,
    modalidade: {
      id: 'modalidade-1',
      eventoId,
      capacidade: null,
      evento: { id: eventoId, capacidade: null, dataInicio: dataEvento },
    },
  };

  const lotePadrao = { id: 'lote-1', eventoId };

  // O lote so entra na lista quando esta dentro da janela de venda e tem preco
  // pra modalidade — a consulta ja filtra isso. `quantidade: null` = sem limite.
  const loteDisponivel = {
    id: 'lote-1',
    eventoId,
    quantidade: null,
    _count: { inscricoes: 0 },
  };

  beforeEach(async () => {
    tx = {
      cupom: { update: jest.fn() },
      inscricao: {
        create: jest.fn().mockResolvedValue({
          id: 'inscricao-1',
          clienteId,
          categoriaId: dto.categoriaId,
          loteId: dto.loteId,
          status: StatusInscricao.PENDENTE_PAGAMENTO,
        }),
      },
    };

    prisma = {
      usuario: { findUnique: jest.fn() },
      cliente: { findUnique: jest.fn() },
      categoria: { findUnique: jest.fn() },
      lote: { findUnique: jest.fn(), findMany: jest.fn() },
      loteModalidadePreco: { findUnique: jest.fn() },
      cupom: { findUnique: jest.fn() },
      evento: { findUnique: jest.fn() },
      inscricao: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn((fn: any) => fn(tx)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        InscricaoService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(InscricaoService);

    // Caminho feliz por padrao; cada teste quebra so o que quer testar.
    prisma.usuario.findUnique.mockResolvedValue({ emailVerificado: true });
    prisma.cliente.findUnique.mockResolvedValue({
      id: clienteId,
      usuarioId,
      pf: {
        dataNascimento: new Date('1990-01-01'),
        genero: 'MASCULINO',
        pcd: false,
      },
    });
    prisma.categoria.findUnique.mockResolvedValue(categoriaPadrao);
    prisma.lote.findUnique.mockResolvedValue(lotePadrao);
    prisma.lote.findMany.mockResolvedValue([loteDisponivel]);
    prisma.inscricao.findFirst.mockResolvedValue(null);
    prisma.loteModalidadePreco.findUnique.mockResolvedValue({
      id: 'preco-1',
      valor: '60',
    });
    prisma.evento.findUnique.mockResolvedValue({
      aplicaDescontoIdoso: false,
      percentualDescontoIdoso: null,
      dataInicio: dataEvento,
      taxaRepassadaAtleta: false,
      organizador: { comissaoPercentual: 10 },
    });
  });

  describe('create', () => {
    it('exige e-mail verificado antes de qualquer outra coisa', async () => {
      prisma.usuario.findUnique.mockResolvedValue({ emailVerificado: false });

      await expect(service.create(usuarioId, dto)).rejects.toThrow(
        ForbiddenException,
      );
      // Barra antes de tocar no cadastro: conta nao confirmada nao inscreve.
      expect(prisma.cliente.findUnique).not.toHaveBeenCalled();
    });

    it('lanca NotFoundException se o cliente ainda nao completou o perfil', async () => {
      prisma.cliente.findUnique.mockResolvedValue(null);

      await expect(service.create(usuarioId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lanca NotFoundException se a categoria nao existir', async () => {
      prisma.categoria.findUnique.mockResolvedValue(null);

      await expect(service.create(usuarioId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lanca NotFoundException se o lote nao existir', async () => {
      prisma.lote.findUnique.mockResolvedValue(null);

      await expect(service.create(usuarioId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lanca BadRequestException se categoria e lote forem de eventos diferentes', async () => {
      prisma.lote.findUnique.mockResolvedValue({
        id: 'lote-1',
        eventoId: 'outro-evento',
      });

      await expect(service.create(usuarioId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lanca BadRequestException se nenhum lote estiver aberto para a modalidade', async () => {
      prisma.lote.findMany.mockResolvedValue([]);

      await expect(service.create(usuarioId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lanca BadRequestException se o lote ja esgotou as vagas', async () => {
      prisma.lote.findMany.mockResolvedValue([
        { ...loteDisponivel, quantidade: 10, _count: { inscricoes: 10 } },
      ]);

      await expect(service.create(usuarioId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lanca BadRequestException se nao houver preco pra essa modalidade nesse lote', async () => {
      prisma.loteModalidadePreco.findUnique.mockResolvedValue(null);

      await expect(service.create(usuarioId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lanca ConflictException se o cliente ja tiver inscricao confirmada nesse evento', async () => {
      prisma.inscricao.findFirst
        .mockResolvedValueOnce(null) // nenhuma pendente
        .mockResolvedValueOnce({ id: 'inscricao-antiga' }); // ja confirmada

      await expect(service.create(usuarioId, dto)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('cancela a tentativa pendente anterior antes de criar outra', async () => {
      prisma.inscricao.findFirst
        .mockResolvedValueOnce({ id: 'inscricao-pendente' })
        .mockResolvedValueOnce(null);

      await service.create(usuarioId, dto);

      // Sem cancelar, a tentativa abandonada seguiria segurando vaga e cupom.
      expect(prisma.inscricao.update).toHaveBeenCalledWith({
        where: { id: 'inscricao-pendente' },
        data: { status: StatusInscricao.CANCELADA },
      });
    });

    it('cria a inscricao pendente e devolve com o valor resolvido', async () => {
      const resultado = await service.create(usuarioId, dto);

      expect(tx.inscricao.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          clienteId,
          categoriaId: dto.categoriaId,
          loteId: 'lote-1',
          status: StatusInscricao.PENDENTE_PAGAMENTO,
        }),
      });
      expect(resultado).toEqual(
        expect.objectContaining({ id: 'inscricao-1', valor: 60 }),
      );
    });
  });
});
