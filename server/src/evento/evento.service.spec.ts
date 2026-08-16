import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EventoService } from './evento.service';
import { PrismaService } from '../prisma/prisma.service';

describe('EventoService', () => {
  let service: EventoService;
  let prisma: {
    evento: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      evento: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [EventoService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(EventoService);
  });

  describe('findPublicados', () => {
    it('busca eventos com status PUBLICADO ordenados por dataInicio', async () => {
      prisma.evento.findMany.mockResolvedValue([
        { id: 'evento-1', nome: 'Corrida de Verão', lotes: [] },
      ]);

      await service.findPublicados();

      expect(prisma.evento.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'PUBLICADO' },
          orderBy: { dataInicio: 'asc' },
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
    it('lança NotFoundException se o evento não existir ou não estiver publicado', async () => {
      prisma.evento.findFirst.mockResolvedValue(null);

      await expect(
        service.findOneDetalhado('evento-inexistente'),
      ).rejects.toThrow(NotFoundException);
    });

    it('retorna o evento com modalidades e lotes', async () => {
      const evento = {
        id: 'evento-1',
        nome: 'Corrida de Verão',
        modalidades: [],
        lotes: [],
      };
      prisma.evento.findFirst.mockResolvedValue(evento);

      const resultado = await service.findOneDetalhado('evento-1');

      expect(prisma.evento.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'evento-1', status: 'PUBLICADO' },
        }),
      );
      expect(resultado).toEqual(evento);
    });
  });
});
