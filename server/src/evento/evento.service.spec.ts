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

    it('evento publicado com lote que ainda nao abriu sai como EM_BREVE', async () => {
      const abre = new Date(Date.now() + 48 * 3_600_000);
      prisma.evento.findMany.mockResolvedValue([
        {
          id: 'evento-1',
          nome: 'Corrida',
          status: StatusEvento.PUBLICADO,
          lotes: [
            {
              inicioVenda: abre,
              fimVenda: new Date(abre.getTime() + 3_600_000),
              precos: [{ valor: '60' }],
            },
          ],
        },
      ]);

      const [evento] = await service.findPublicados();

      expect(evento.situacaoVendas).toBe('EM_BREVE');
      expect(evento.vendasAbremEm).toEqual(abre);
      expect(evento.valorApartirDe).toBe(60);
    });

    it('evento esgotado nao recebe situacao de vendas', async () => {
      prisma.evento.findMany.mockResolvedValue([
        { id: 'evento-1', nome: 'Corrida', status: StatusEvento.INSCRICOES_ENCERRADAS, lotes: [] },
      ]);

      const [evento] = await service.findPublicados();

      expect(evento.situacaoVendas).toBeNull();
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

  describe('evento 100% gratuito', () => {
    const ORGANIZADOR = {
      cliente: { pf: { nomeCompleto: 'Prefeitura', celular: '63999999999' }, pj: null },
    };

    const eventoGratuito = (vagasEventoGratuito: number | null) => ({
      id: UUID_EVENTO,
      nome: 'Corrida da Cidade',
      capacidade: null,
      eventoGratuito: true,
      vagasEventoGratuito,
      camisaOpcional: true,
      valorCamisaOpcional: '30',
      aplicaDescontoIdoso: true,
      aplicaDescontoPcd: true,
      modalidades: [
        { id: 'mod-1', ativo: true, capacidade: null, categorias: [{ id: 'cat-1', capacidade: null, _count: { inscricoes: 0 } }] },
      ],
      lotes: [
        { id: 'lote-1', quantidade: null, precos: [{ id: 'p-1', modalidadeId: 'mod-1', valor: '60' }], _count: { inscricoes: 0 } },
      ],
      organizador: ORGANIZADOR,
    });

    it('vitrine mostra Gratuito (a partir de R$ 0)', async () => {
      prisma.evento.findMany.mockResolvedValue([
        { id: 'evento-1', eventoGratuito: true, lotes: [{ precos: [{ valor: '60' }] }] },
      ]);

      const [evento] = await service.findPublicados();

      expect(evento.valorApartirDe).toBe(0);
    });

    it('pagina do evento recebe preco, camisa e descontos zerados', async () => {
      prisma.evento.findFirst.mockResolvedValue(eventoGratuito(null));

      const resultado: any = await service.findOneDetalhado(UUID_EVENTO);

      expect(resultado.lotes[0].precos[0].valor).toBe(0);
      expect(resultado.valorCamisaOpcional).toBeNull();
      expect(resultado.aplicaDescontoIdoso).toBe(false);
      expect(resultado.aplicaDescontoPcd).toBe(false);
      expect(resultado.vagasGratuitasRestantes).toBeNull();
      expect(resultado.modalidades[0].vagasRestantes).toBeNull();
      expect(prisma.inscricao.count).not.toHaveBeenCalled();
    });

    it('vagas gratuitas acabaram: pagina mostra esgotado', async () => {
      prisma.evento.findFirst.mockResolvedValue({
        ...eventoGratuito(2000),
        status: StatusEvento.PUBLICADO,
      });
      prisma.inscricao.count.mockResolvedValue(2000);

      const resultado: any = await service.findOneDetalhado(UUID_EVENTO);

      expect(resultado.status).toBe(StatusEvento.INSCRICOES_ENCERRADAS);
      expect(resultado.situacaoVendas).toBeNull();
      expect(resultado.vagasGratuitasRestantes).toBe(0);
      expect(resultado.vagasRestantes).toBe(0);
      expect(resultado.modalidades[0].vagasRestantes).toBe(0);
    });

    it('ainda com vaga gratuita: pagina continua aberta', async () => {
      prisma.evento.findFirst.mockResolvedValue({
        ...eventoGratuito(2000),
        status: StatusEvento.PUBLICADO,
      });
      prisma.inscricao.count.mockResolvedValue(1999);

      const resultado: any = await service.findOneDetalhado(UUID_EVENTO);

      expect(resultado.status).toBe(StatusEvento.PUBLICADO);
      expect(resultado.vagasGratuitasRestantes).toBe(1);
    });

    it('vitrine: so o evento gratuito lotado aparece como esgotado', async () => {
      const lote = { inicioVenda: new Date(0), fimVenda: new Date(Date.now() + 3_600_000), precos: [] };
      prisma.evento.findMany.mockResolvedValue([
        { id: 'lotado', status: StatusEvento.PUBLICADO, eventoGratuito: true, vagasEventoGratuito: 2000, lotes: [lote] },
        { id: 'com-vaga', status: StatusEvento.PUBLICADO, eventoGratuito: true, vagasEventoGratuito: 2000, lotes: [lote] },
        { id: 'pago', status: StatusEvento.PUBLICADO, eventoGratuito: false, vagasEventoGratuito: null, lotes: [lote] },
      ]);
      prisma.inscricao.count.mockImplementation(({ where }: any) =>
        Promise.resolve(where.categoria.modalidade.eventoId === 'lotado' ? 2000 : 10),
      );

      const [lotado, comVaga, pago] = await service.findPublicados();

      expect(lotado.status).toBe(StatusEvento.INSCRICOES_ENCERRADAS);
      expect(lotado.situacaoVendas).toBeNull();
      expect(comVaga.status).toBe(StatusEvento.PUBLICADO);
      expect(comVaga.situacaoVendas).toBe('ABERTAS');
      expect(pago.status).toBe(StatusEvento.PUBLICADO);
      // Evento pago nao gera consulta extra
      expect(prisma.inscricao.count).toHaveBeenCalledTimes(2);
    });

    it('evento pago continua com o preco cadastrado', async () => {
      prisma.evento.findFirst.mockResolvedValue({ ...eventoGratuito(null), eventoGratuito: false });

      const resultado: any = await service.findOneDetalhado(UUID_EVENTO);

      expect(resultado.lotes[0].precos[0].valor).toBe('60');
      expect(resultado.valorCamisaOpcional).toBe('30');
      expect(resultado).not.toHaveProperty('vagasGratuitasRestantes');
    });
  });

  describe('findOneDetalhado', () => {
    const ORGANIZADOR_PF = {
      cliente: { pf: { nomeCompleto: 'Douglas Costa', celular: '63999302148' }, pj: null },
    };

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
        organizador: ORGANIZADOR_PF,
      };
      prisma.evento.findFirst.mockResolvedValue(evento);

      const resultado = await service.findOneDetalhado(UUID_EVENTO);

      expect(prisma.evento.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: UUID_EVENTO, status: { in: STATUS_VISIVEIS } },
        }),
      );
      const { organizador: _organizador, ...semOrganizador } = evento;
      expect(resultado).toEqual({
        ...semOrganizador,
        organizador: { nome: 'Douglas Costa', whatsapp: '63999302148' },
        vagasRestantes: null,
        // Campos novos do aviso de abertura de vendas (evento sem status aqui)
        situacaoVendas: null,
        vendasAbremEm: null,
        agoraServidor: expect.any(Date),
      });

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
        organizador: ORGANIZADOR_PF,
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

    it('organizador empresa: nome fantasia e celular comercial', async () => {
      prisma.evento.findFirst.mockResolvedValue({
        id: UUID_EVENTO,
        capacidade: null,
        modalidades: [],
        lotes: [],
        organizador: {
          cliente: {
            pf: null,
            pj: { nomeFantasia: 'Doka Embalagens', razaoSocial: 'Doka LTDA', celularComercial: '63988887777' },
          },
        },
      });

      const resultado = await service.findOneDetalhado(UUID_EVENTO);

      expect(resultado.organizador).toEqual({ nome: 'Doka Embalagens', whatsapp: '63988887777' });
    });

    it('empresa sem nome fantasia usa a razao social', async () => {
      prisma.evento.findFirst.mockResolvedValue({
        id: UUID_EVENTO,
        capacidade: null,
        modalidades: [],
        lotes: [],
        organizador: {
          cliente: {
            pf: null,
            pj: { nomeFantasia: null, razaoSocial: 'Doka LTDA', celularComercial: '' },
          },
        },
      });

      const resultado = await service.findOneDetalhado(UUID_EVENTO);

      expect(resultado.organizador).toEqual({ nome: 'Doka LTDA', whatsapp: null });
    });

    it('do organizador so consulta nome e celular (nada de CPF, CNPJ ou banco)', async () => {
      prisma.evento.findFirst.mockResolvedValue({
        id: UUID_EVENTO,
        capacidade: null,
        modalidades: [],
        lotes: [],
        organizador: ORGANIZADOR_PF,
      });

      await service.findOneDetalhado(UUID_EVENTO);

      const { select } = prisma.evento.findFirst.mock.calls[0][0];
      expect(select.organizador).toEqual({
        select: {
          cliente: {
            select: {
              pf: { select: { nomeCompleto: true, celular: true } },
              pj: { select: { nomeFantasia: true, razaoSocial: true, celularComercial: true } },
            },
          },
        },
      });
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
