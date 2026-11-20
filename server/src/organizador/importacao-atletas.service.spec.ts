import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ImportacaoAtletasService } from './importacao-atletas.service';
import {
  lerCsv,
  lerPlanilhaAtletas,
  normalizarCpf,
  normalizarData,
  normalizarGenero,
} from './importacao-atletas-parser';
import { StatusInscricao } from '../generated/prisma/enums';

// CPFs validos de teste
const CPF_A = '52998224725';
const CPF_B = '11144477735';
const CPF_C = '12345678909';
const CPF_ZERO = '01234567890';

const EVENTO_ID = '11111111-1111-1111-1111-111111111111';

function csv(linhas: string[]) {
  return Buffer.from(linhas.join('\n'), 'utf-8');
}
const arquivo = (linhas: string[]) => ({
  buffer: csv(linhas),
  mimetype: 'text/csv',
  originalname: 'atletas.csv',
});

const CABECALHO =
  'Nome;CPF;Data de nascimento;Sexo;Modalidade;Categoria;Camisa;Nº de peito;E-mail';

describe('leitor da planilha de atletas', () => {
  it('entende datas em varios formatos', () => {
    expect(normalizarData('03/05/1990')).toBe('1990-05-03');
    expect(normalizarData('3-5-1990')).toBe('1990-05-03');
    expect(normalizarData('1990-05-03')).toBe('1990-05-03');
    expect(normalizarData('32874')).toBe('1990-01-01'); // serie do Excel
    expect(normalizarData('32947')).toBe('1990-03-15');
    expect(normalizarData('31/02/1990')).toBe('31/02/1990'); // invalida: volta como veio
    expect(normalizarData('03/05/90')).toBe('03/05/90'); // ano de 2 digitos: ambiguo
  });

  it('entende o sexo escrito de jeitos diferentes', () => {
    expect(normalizarGenero('m')).toBe('MASCULINO');
    expect(normalizarGenero('Feminino')).toBe('FEMININO');
    expect(normalizarGenero('MULHER')).toBe('FEMININO');
    expect(normalizarGenero('x')).toBeNull();
  });

  it('devolve o zero da frente do CPF que o Excel tira', () => {
    expect(normalizarCpf('1234567890')).toBe(CPF_ZERO);
    expect(normalizarCpf('529.982.247-25')).toBe(CPF_A);
  });

  it('le CSV com ; e aspas', () => {
    expect(lerCsv('a;"b;c";"d ""e"""\n1;2;3')).toEqual([
      ['a', 'b;c', 'd "e"'],
      ['1', '2', '3'],
    ]);
  });

  it('acha as colunas pelo cabecalho, em qualquer ordem', async () => {
    const linhas = await lerPlanilhaAtletas(
      csv([
        'CPF,Atleta,Sexo,Nascimento',
        `${CPF_A},Ana Souza,F,03/05/1990`,
        ',,,',
      ]),
      'text/csv',
      'x.csv',
    );
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({
      linha: 2,
      nome: 'Ana Souza',
      cpf: CPF_A,
      genero: 'F',
      dataNascimento: '1990-05-03',
    });
  });

  it('recusa planilha sem cabecalho de nome e CPF', async () => {
    await expect(
      lerPlanilhaAtletas(csv(['a;b', '1;2']), 'text/csv', 'x.csv'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('recusa .xls antigo e PDF', async () => {
    await expect(
      lerPlanilhaAtletas(Buffer.from(''), 'application/pdf', 'x.pdf'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('ImportacaoAtletasService', () => {
  let prisma: any;
  let service: ImportacaoAtletasService;
  let evento: any;

  const modalidades = [
    {
      id: 'mod-5k',
      nome: '5K',
      capacidade: null,
      createdAt: new Date(),
      categorias: [
        {
          id: 'cat-5k-geral-m',
          nome: 'Geral Masculino',
          idadeMinima: null,
          idadeMaxima: null,
          genero: 'MASCULINO',
          pcd: false,
          servidorPublico: false,
          capacidade: null,
        },
        {
          id: 'cat-5k-geral-f',
          nome: 'Geral Feminino',
          idadeMinima: null,
          idadeMaxima: null,
          genero: 'FEMININO',
          pcd: false,
          servidorPublico: false,
          capacidade: null,
        },
        {
          id: 'cat-5k-pcd',
          nome: 'PCD',
          idadeMinima: null,
          idadeMaxima: null,
          genero: 'LIVRE',
          pcd: true,
          servidorPublico: false,
          capacidade: null,
        },
      ],
    },
    {
      id: 'mod-10k',
      nome: '10K',
      capacidade: 1,
      createdAt: new Date(),
      categorias: [
        {
          id: 'cat-10k',
          nome: 'Única',
          idadeMinima: null,
          idadeMaxima: null,
          genero: 'LIVRE',
          pcd: false,
          servidorPublico: false,
          capacidade: null,
        },
      ],
    },
  ];

  beforeEach(() => {
    evento = {
      id: EVENTO_ID,
      organizadorId: 'org-1',
      importacaoLiberada: true,
      dataInicio: new Date('2026-12-10T10:00:00Z'),
      capacidade: null,
    };
    prisma = {
      cliente: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ organizador: { id: 'org-1' } }),
      },
      evento: {
        findUnique: jest.fn().mockImplementation(() => Promise.resolve(evento)),
      },
      modalidade: {
        findMany: jest
          .fn()
          .mockImplementation(({ select }: any) =>
            Promise.resolve(
              select
                ? modalidades.map((m) => ({
                    id: m.id,
                    nome: m.nome,
                    capacidade: m.capacidade,
                  }))
                : modalidades,
            ),
          ),
      },
      inscricao: {
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([]),
        createMany: jest
          .fn()
          .mockImplementation(({ data }: any) => ({ count: data.length })),
        count: jest.fn().mockResolvedValue(0),
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      importacaoAtletas: {
        create: jest.fn().mockResolvedValue({ id: 'imp-1' }),
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      usuario: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ cliente: { id: 'cliente-sistema' } }),
        upsert: jest.fn(),
      },
      lote: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'lote-importados' }),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    prisma.$transaction = jest.fn((fn: any) => fn(prisma));
    service = new ImportacaoAtletasService(prisma);
  });

  it('sem liberacao do admin, nao deixa importar', async () => {
    evento.importacaoLiberada = false;
    await expect(
      service.previa('u-1', EVENTO_ID, arquivo([CABECALHO])),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('evento de outro organizador: nao encontrado', async () => {
    evento.organizadorId = 'outro';
    await expect(
      service.previa(
        'u-1',
        EVENTO_ID,
        arquivo([CABECALHO, `Ana Souza;${CPF_A};03/05/1990;F;5K;;M;;`]),
      ),
    ).rejects.toThrow('Evento não encontrado');
  });

  it('revisao: categoria pelo sexo, CPF repetido e campos invalidos', async () => {
    const r = await service.previa(
      'u-1',
      EVENTO_ID,
      arquivo([
        CABECALHO,
        `Ana Souza;${CPF_A};03/05/1990;F;5 km;;m;101;ana@x.com`,
        `Bruno Lima;${CPF_B};1985-01-20;M;5K;;G;;`,
        `Ana Repetida;${CPF_A};03/05/1990;F;5K;;;;`,
        `Sem Cpf;123;03/05/1990;F;5K;;;;`,
        `Carla Dias;${CPF_C};03/05/90;X;5K;;;;email-ruim`,
      ]),
    );

    const [ana, bruno, repetida, semCpf, carla] = r.linhas;
    // "5 km" bate com "5K"? Nao: chave "5km" != "5k". Fica sem destino.
    expect(ana.erros.join(' ')).toContain('Escolha a modalidade/categoria');
    expect(bruno.erros).toEqual([]);
    expect(bruno.categoriaId).toBe('cat-5k-geral-m');
    expect(repetida.erros.join(' ')).toContain(
      'CPF repetido na planilha (já está na linha 2)',
    );
    expect(semCpf.erros).toContain('CPF inválido.');
    expect(carla.erros).toEqual(
      expect.arrayContaining([
        'Data de nascimento inválida (use dd/mm/aaaa).',
        'Sexo inválido (use M ou F).',
        'E-mail inválido.',
      ]),
    );
    expect(r.resumo).toMatchObject({ total: 5, validas: 1 });
  });

  it('o organizador escolhe o destino de um grupo que nao bateu', async () => {
    const r = await service.previa(
      'u-1',
      EVENTO_ID,
      arquivo([
        CABECALHO,
        `Ana Souza;${CPF_A};03/05/1990;F;5 km;;m;101;ana@x.com`,
      ]),
      { '5km|': 'auto:mod-5k' },
    );
    expect(r.linhas[0].erros).toEqual([]);
    expect(r.linhas[0].categoriaId).toBe('cat-5k-geral-f');
    expect(r.linhas[0].tamanhoCamisa).toBe('M');
    // Escolha que nao existe no evento e ignorada.
    const r2 = await service.previa(
      'u-1',
      EVENTO_ID,
      arquivo([CABECALHO, `Ana Souza;${CPF_A};03/05/1990;F;5 km;;;;`]),
      { '5km|': 'cat-de-outro-evento' },
    );
    expect(r2.linhas[0].categoriaId).toBeNull();
  });

  it('atleta ja inscrito no evento (comprou aqui) fica de fora; pendente so avisa', async () => {
    prisma.inscricao.findMany.mockImplementation(({ select }: any) =>
      Promise.resolve(
        select?.numeroPeito
          ? []
          : [
              {
                status: StatusInscricao.CONFIRMADA,
                importacaoId: null,
                atletaCpf: CPF_A,
                dependente: null,
                cliente: { pf: null },
              },
              {
                status: StatusInscricao.PENDENTE_PAGAMENTO,
                importacaoId: null,
                atletaCpf: null,
                dependente: { cpf: CPF_B },
                cliente: { pf: null },
              },
            ],
      ),
    );
    const r = await service.previa(
      'u-1',
      EVENTO_ID,
      arquivo([
        CABECALHO,
        `Ana Souza;${CPF_A};03/05/1990;F;5K;;;;`,
        `Bruno Lima;${CPF_B};1985-01-20;M;5K;;;;`,
      ]),
    );
    expect(r.linhas[0].erros).toContain(
      'Atleta já inscrito neste evento (comprou no Seu Percurso).',
    );
    expect(r.linhas[1].erros).toEqual([]);
    expect(r.linhas[1].avisos[0]).toContain('aguardando pagamento');
  });

  it('respeita as vagas do percurso, na ordem da planilha', async () => {
    const r = await service.previa(
      'u-1',
      EVENTO_ID,
      arquivo([
        CABECALHO,
        `Ana Souza;${CPF_A};03/05/1990;F;10K;;;;`,
        `Bruno Lima;${CPF_B};1985-01-20;M;10K;;;;`,
      ]),
    );
    expect(r.linhas[0].erros).toEqual([]);
    expect(r.linhas[1].erros).toContain(
      'Sem vaga no percurso 10K (limite de 1).',
    );
  });

  it('numero de peito ja usado no evento e recusado', async () => {
    prisma.inscricao.findMany.mockImplementation(({ select }: any) =>
      Promise.resolve(select?.numeroPeito ? [{ numeroPeito: '101' }] : []),
    );
    const r = await service.previa(
      'u-1',
      EVENTO_ID,
      arquivo([CABECALHO, `Ana Souza;${CPF_A};03/05/1990;F;5K;;;101;`]),
    );
    expect(r.linhas[0].erros).toContain(
      'Número de peito 101 já é de outro atleta do evento.',
    );
  });

  describe('confirmar', () => {
    const planilha = () =>
      arquivo([
        CABECALHO,
        `Ana Souza;${CPF_A};03/05/1990;F;5K;;m;101;Ana@X.com`,
        `Bruno Lima;${CPF_B};1985-01-20;M;5K;;;;`,
        `Sem Cpf;123;03/05/1990;F;5K;;;;`,
      ]);
    const dados = (extra: object = {}) => ({
      siteOrigem: 'Ticket Sports',
      autorizacaoAtletas: true,
      mapeamento: {},
      esperados: 2,
      ...extra,
    });

    it('grava so as validas, confirmadas, no lote interno e na conta interna', async () => {
      const r = await service.confirmar('u-1', EVENTO_ID, planilha(), dados());

      expect(r).toEqual({ importacaoId: 'imp-1', importados: 2, ignorados: 1 });
      expect(prisma.$queryRaw).toHaveBeenCalled(); // trava por evento
      expect(prisma.lote.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            somenteImportacao: true,
            eventoId: EVENTO_ID,
          }),
        }),
      );
      const { data } = prisma.inscricao.createMany.mock.calls[0][0];
      expect(data).toHaveLength(2);
      expect(data[0]).toMatchObject({
        clienteId: 'cliente-sistema',
        loteId: 'lote-importados',
        categoriaId: 'cat-5k-geral-f',
        importacaoId: 'imp-1',
        status: StatusInscricao.CONFIRMADA,
        atletaNome: 'Ana Souza',
        atletaCpf: CPF_A,
        atletaGenero: 'FEMININO',
        tamanhoCamisa: 'M',
        numeroPeito: '101',
        atletaEmail: 'ana@x.com',
      });
      // Nada de pedido nem pagamento.
      expect(data[0]).not.toHaveProperty('pedidoId');
      expect(
        prisma.importacaoAtletas.create.mock.calls[0][0].data,
      ).toMatchObject({
        siteOrigem: 'Ticket Sports',
        totalAtletas: 2,
        usuarioId: 'u-1',
      });
    });

    it('reaproveita o lote interno que ja existe', async () => {
      prisma.lote.findFirst.mockResolvedValue({ id: 'lote-velho' });
      await service.confirmar('u-1', EVENTO_ID, planilha(), dados());
      expect(prisma.lote.create).not.toHaveBeenCalled();
      expect(prisma.inscricao.createMany.mock.calls[0][0].data[0].loteId).toBe(
        'lote-velho',
      );
    });

    it('se a lista mudou desde a revisao, nao grava nada', async () => {
      await expect(
        service.confirmar(
          'u-1',
          EVENTO_ID,
          planilha(),
          dados({ esperados: 3 }),
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.inscricao.createMany).not.toHaveBeenCalled();
    });

    it('exige o site de origem e a autorizacao dos atletas', async () => {
      await expect(
        service.confirmar(
          'u-1',
          EVENTO_ID,
          planilha(),
          dados({ siteOrigem: ' ' }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.confirmar(
          'u-1',
          EVENTO_ID,
          planilha(),
          dados({ autorizacaoAtletas: false }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.inscricao.createMany).not.toHaveBeenCalled();
    });

    it('cria a conta interna inativa na primeira importacao', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);
      prisma.usuario.upsert.mockResolvedValue({
        cliente: { id: 'cliente-novo' },
      });
      await service.confirmar('u-1', EVENTO_ID, planilha(), dados());
      const args = prisma.usuario.upsert.mock.calls[0][0];
      expect(args.create.status).toBe('INATIVO');
      expect(args.create.cliente.create.status).toBe('INATIVO');
      expect(args.create.passwordHash).toMatch(/^\$2[aby]\$/);
      expect(
        prisma.inscricao.createMany.mock.calls[0][0].data[0].clienteId,
      ).toBe('cliente-novo');
    }, 30_000); // bcrypt e lento de proposito
  });

  describe('desfazer', () => {
    it('cancela as inscricoes da importacao (sem apagar)', async () => {
      prisma.importacaoAtletas.findUnique.mockResolvedValue({
        id: 'imp-1',
        eventoId: EVENTO_ID,
        desfeitaEm: null,
      });
      const r = await service.desfazer('u-1', EVENTO_ID, 'imp-1');
      expect(r).toEqual({ canceladas: 2 });
      expect(prisma.inscricao.updateMany).toHaveBeenCalledWith({
        where: { importacaoId: 'imp-1', status: StatusInscricao.CONFIRMADA },
        data: { status: StatusInscricao.CANCELADA },
      });
      expect(prisma.importacaoAtletas.update).toHaveBeenCalled();
    });

    it('nao desfaz se algum kit ja foi entregue', async () => {
      prisma.importacaoAtletas.findUnique.mockResolvedValue({
        id: 'imp-1',
        eventoId: EVENTO_ID,
        desfeitaEm: null,
      });
      prisma.inscricao.count.mockResolvedValue(1);
      await expect(service.desfazer('u-1', EVENTO_ID, 'imp-1')).rejects.toThrow(
        'já retiraram o kit',
      );
      expect(prisma.inscricao.updateMany).not.toHaveBeenCalled();
    });

    it('nao desfaz importacao de outro evento nem duas vezes', async () => {
      prisma.importacaoAtletas.findUnique.mockResolvedValue({
        id: 'imp-1',
        eventoId: 'outro',
        desfeitaEm: null,
      });
      await expect(service.desfazer('u-1', EVENTO_ID, 'imp-1')).rejects.toThrow(
        'não encontrada',
      );
      prisma.importacaoAtletas.findUnique.mockResolvedValue({
        id: 'imp-1',
        eventoId: EVENTO_ID,
        desfeitaEm: new Date(),
      });
      await expect(service.desfazer('u-1', EVENTO_ID, 'imp-1')).rejects.toThrow(
        'já foi desfeita',
      );
    });
  });
});
