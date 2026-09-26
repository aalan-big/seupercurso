import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EventoService } from './evento.service';
import { PrismaService } from '../prisma/prisma.service';
import { StatusEvento } from '../generated/prisma/enums';

/**
 * A vitrine mostra evento publicado, com inscricoes encerradas e finalizado: um
 * evento que ja aconteceu continua tendo pagina, resultado e certificado.
 */
const STATUS_VISIVEIS = [
  StatusEvento.PUBLICADO,
  StatusEvento.INSCRICOES_ENCERRADAS,
  StatusEvento.FINALIZADO,
];

const UUID_EVENTO = '963bdda4-193c-4c11-9293-237477ebc195';

describe('EventoService', () => {
  let service: EventoService;
  let prisma: {
    evento: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
    };
    cupom: { findFirst: jest.Mock };
    cliente: { findUnique: jest.Mock };
    inscricao: { count: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      evento: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      cupom: { findFirst: jest.fn() },
      cliente: { findUnique: jest.fn() },
      inscricao: { count: jest.fn().mockResolvedValue(0) },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [EventoService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(EventoService);
  });

  describe('findPublicados', () => {
    it('busca os eventos visiveis do mais recente cadastrado para o mais antigo', async () => {
      prisma.evento.findMany.mockResolvedValue([
        { id: 'evento-1', nome: 'Corrida de Verão', lotes: [] },
      ]);

      await service.findPublicados();

      expect(prisma.evento.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: { in: STATUS_VISIVEIS } },
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('calcula valorApartirDe como o menor preço entre os lotes ativos', async () => {
      prisma.evento.findMany.mockResolvedValue([
        {
          id: 'evento-1',
          nome: 'Corrida de Verão',
          lotes: [
            { precos: [{ valor: '90' }, { valor: '60' }] },
            { precos: [{ valor: '75' }] },
          ],
        },
      ]);

      const resultado = await service.findPublicados();

      expect(resultado).toEqual([
        expect.objectContaining({ id: 'evento-1', valorApartirDe: 60 }),
      ]);
      expect(resultado[0]).not.toHaveProperty('lotes');
    });

    it('retorna valorApartirDe null se não houver lote ativo com preço', async () => {
      prisma.evento.findMany.mockResolvedValue([
        { id: 'evento-1', nome: 'Corrida de Verão', lotes: [] },
      ]);

      const resultado = await service.findPublicados();

      expect(resultado).toEqual([
        expect.objectContaining({ valorApartirDe: null }),
      ]);
    });
  });

  describe('findOneDetalhado', () => {
    it('lança NotFoundException se o evento não existir ou não estiver visível', async () => {
      prisma.evento.findMany.mockResolvedValue([]);
      prisma.evento.findFirst.mockResolvedValue(null);

      await expect(
        service.findOneDetalhado('evento-inexistente'),
      ).rejects.toThrow(NotFoundException);
    });

    it('retorna o evento enriquecido com as vagas restantes', async () => {
      // `capacidade: null` significa evento sem limite de vagas. Precisa vir no
      // fixture: o servico compara com null, e um campo ausente viraria NaN.
      const evento = {
        id: UUID_EVENTO,
        nome: 'Corrida de Verão',
        capacidade: null,
        modalidades: [],
        lotes: [],
      };
      prisma.evento.findFirst.mockResolvedValue(evento);

      const resultado = await service.findOneDetalhado(UUID_EVENTO);

      expect(prisma.evento.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: UUID_EVENTO, status: { in: STATUS_VISIVEIS } },
        }),
      );
      expect(resultado).toEqual({ ...evento, vagasRestantes: null });

      // Id ja e um UUID: nao ha por que varrer a tabela procurando prefixo.
      expect(prisma.evento.findMany).not.toHaveBeenCalled();
    });

    it('aceita o começo do id e resolve para o evento inteiro', async () => {
      const evento = {
        id: UUID_EVENTO,
        nome: 'Corrida de Verão',
        capacidade: null,
        modalidades: [],
        lotes: [],
      };
      prisma.evento.findMany.mockResolvedValue([
        { id: 'outro-evento-qualquer' },
        { id: UUID_EVENTO },
      ]);
      prisma.evento.findFirst.mockResolvedValue(evento);

      await service.findOneDetalhado('963BDDA4');

      // Casa sem diferenciar maiusculas, e consulta pelo id completo.
      expect(prisma.evento.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: UUID_EVENTO, status: { in: STATUS_VISIVEIS } },
        }),
      );
    });
  });

  describe('validarCupom', () => {
    const cupom = {
      id: 'cupom-1',
      codigo: 'BB10',
      ativo: true,
      validoAte: null,
      percentualDesconto: '10',
      quantidadeMaxima: 1,
    };

    beforeEach(() => {
      prisma.cupom.findFirst.mockResolvedValue(cupom);
    });

    it('com login, nao conta as pendentes do proprio comprador', async () => {
      prisma.cliente.findUnique.mockResolvedValue({ id: 'cliente-1' });

      const res = await service.validarCupom(UUID_EVENTO, 'bb10', 'usuario-1');

      expect(res).toEqual({ valido: true, codigo: 'BB10', percentualDesconto: 10 });
      const where = prisma.inscricao.count.mock.calls[0][0].where;
      expect(where.OR[1].clienteId).toEqual({ not: 'cliente-1' });
    });

    it('sem login, conta todas as pendentes recentes', async () => {
      await service.validarCupom(UUID_EVENTO, 'BB10');

      expect(prisma.cliente.findUnique).not.toHaveBeenCalled();
      const where = prisma.inscricao.count.mock.calls[0][0].where;
      expect(where.OR[1].clienteId).toBeUndefined();
    });

    it('recusa quando o limite ja foi atingido', async () => {
      prisma.inscricao.count.mockResolvedValue(1);

      await expect(service.validarCupom(UUID_EVENTO, 'BB10')).rejects.toThrow(
        'Este cupom já atingiu o limite de usos.',
      );
    });

    it('recusa codigo que nao existe no evento', async () => {
      prisma.cupom.findFirst.mockResolvedValue(null);

      await expect(service.validarCupom(UUID_EVENTO, 'BB')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
