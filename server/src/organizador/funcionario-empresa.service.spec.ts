import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FuncionarioEmpresaService } from './funcionario-empresa.service';
import { ServidorPublicoParserService } from './servidor-publico-parser.service';
import { PrismaService } from '../prisma/prisma.service';
import { StatusInscricao } from '../generated/prisma/enums';

describe('FuncionarioEmpresaService', () => {
  let service: FuncionarioEmpresaService;
  let prisma: any;
  let parser: { parseArquivo: jest.Mock };

  const usuarioId = 'usuario-1';
  const organizadorId = 'organizador-1';
  const eventoId = 'evento-1';

  const eventoLiberado = {
    id: eventoId,
    organizadorId,
    permiteFuncionarios: true,
    percentualFuncionarios: '50',
    vagasFuncionarios: null,
    nomeEmpresaFuncionarios: 'Dakota',
  };

  beforeEach(async () => {
    prisma = {
      cliente: {
        findUnique: jest.fn().mockResolvedValue({ organizador: { id: organizadorId } }),
      },
      evento: { findUnique: jest.fn().mockResolvedValue(eventoLiberado) },
      funcionarioEmpresa: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockImplementation(({ data }: any) => ({ count: data.length })),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    parser = {
      parseArquivo: jest.fn().mockResolvedValue({
        totalEncontrados: 2,
        linhasIgnoradas: 0,
        servidores: [
          { cpf: '11111111111', matricula: 'D100', nome: 'Ana' },
          { cpf: '22222222222', matricula: 'D200' },
        ],
      }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        FuncionarioEmpresaService,
        { provide: PrismaService, useValue: prisma },
        { provide: ServidorPublicoParserService, useValue: parser },
      ],
    }).compile();

    service = moduleRef.get(FuncionarioEmpresaService);
  });

  describe('importarLista', () => {
    it('recusa quando o admin nao liberou o evento', async () => {
      prisma.evento.findUnique.mockResolvedValue({ ...eventoLiberado, permiteFuncionarios: false });

      await expect(
        service.importarLista(usuarioId, eventoId, Buffer.from('x'), 'text/csv', 'lista.csv'),
      ).rejects.toThrow(ForbiddenException);
      expect(parser.parseArquivo).not.toHaveBeenCalled();
    });

    it('recusa evento de outro organizador', async () => {
      prisma.evento.findUnique.mockResolvedValue({ ...eventoLiberado, organizadorId: 'outro' });

      await expect(
        service.importarLista(usuarioId, eventoId, Buffer.from('x')),
      ).rejects.toThrow(NotFoundException);
    });

    it('grava os funcionarios lidos na tabela propria', async () => {
      const res = await service.importarLista(usuarioId, eventoId, Buffer.from('x'), 'text/csv', 'lista.csv');

      expect(prisma.funcionarioEmpresa.createMany).toHaveBeenCalledWith({
        data: [
          { eventoId, cpf: '11111111111', matricula: 'D100', nome: 'Ana' },
          { eventoId, cpf: '22222222222', matricula: 'D200', nome: null },
        ],
        skipDuplicates: true,
      });
      expect(res.novosInseridos).toBe(2);
    });

    it('arquivo sem nenhum CPF + matricula valido e recusado', async () => {
      parser.parseArquivo.mockResolvedValue({ totalEncontrados: 0, linhasIgnoradas: 5, servidores: [] });

      await expect(
        service.importarLista(usuarioId, eventoId, Buffer.from('x')),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.funcionarioEmpresa.createMany).not.toHaveBeenCalled();
    });

    it('reenvio corrige a matricula so de quem ainda nao se inscreveu', async () => {
      prisma.funcionarioEmpresa.findMany.mockResolvedValue([
        { id: 'f1', cpf: '11111111111', matricula: 'ERRADA', nome: 'Ana' },
      ]);

      await service.importarLista(usuarioId, eventoId, Buffer.from('x'));

      const where = prisma.funcionarioEmpresa.updateMany.mock.calls[0][0].where;
      expect(where.id).toBe('f1');
      expect(where.OR).toEqual([
        { inscricaoId: null },
        {
          inscricao: {
            is: { status: { in: [StatusInscricao.CANCELADA, StatusInscricao.EXPIRADA] } },
          },
        },
      ]);
    });
  });

  it('listar marca como livre quem teve a inscricao cancelada', async () => {
    prisma.funcionarioEmpresa.findMany.mockResolvedValue([
      { id: 'f1', cpf: '1', matricula: 'A', inscricao: { status: StatusInscricao.CONFIRMADA } },
      { id: 'f2', cpf: '2', matricula: 'B', inscricao: { status: StatusInscricao.CANCELADA } },
      { id: 'f3', cpf: '3', matricula: 'C', inscricao: null },
    ]);

    const res = await service.listar(usuarioId, eventoId);

    expect(res.funcionarios.map((f) => f.emUso)).toEqual([true, false, false]);
    expect(res.percentualFuncionarios).toBe(50);
  });

  it('remover nao utilizados nao apaga quem esta inscrito', async () => {
    await service.removerNaoUtilizados(usuarioId, eventoId);

    const where = prisma.funcionarioEmpresa.deleteMany.mock.calls[0][0].where;
    expect(where.eventoId).toBe(eventoId);
    expect(where.OR[0]).toEqual({ inscricaoId: null });
  });
});
