import { Logger } from '@nestjs/common';
import { ExpiracaoInscricaoService } from './expiracao-inscricao.service';
import { prazoPagamento, validadePix } from './prazo-pagamento';

const HORA = 3600_000;

describe('ExpiracaoInscricaoService', () => {
  let prisma: any;
  let pagamentoService: any;
  let gateway: any;
  let email: any;
  let audit: any;
  let mpOAuth: any;

  const inscricao = (extras: object = {}) => ({
    id: 'insc-1',
    pedidoId: 'pedido-1',
    atletaNome: 'Atleta',
    atletaCpf: '123',
    dataInscricao: new Date(Date.now() - 30 * HORA),
    cliente: { pf: { nomeCompleto: 'Comprador' }, usuario: { email: 'a@teste.com' } },
    pagamentos: [],
    pedido: { pagamentos: [] as any[] },
    categoria: {
      modalidade: {
        evento: {
          id: 'evento-1',
          nome: 'Corrida',
          organizadorId: 'org-1',
          status: 'PUBLICADO',
          dataInicio: new Date(Date.now() + 240 * HORA),
        },
      },
    },
    ...extras,
  });

  const achado = (extras: object = {}) => ({
    gatewayPaymentId: 'mp-1',
    status: 'PENDENTE',
    valor: 60,
    valorLiquido: 55,
    ehPix: false,
    expiraEm: null,
    ...extras,
  });

  const criar = (modo: string | undefined, vencidas: any[], recentes: any[] = []) => {
    prisma = {
      inscricao: {
        findMany: jest.fn(({ where }: any) => {
          if (where.status === 'CONFIRMADA') return Promise.resolve([]);
          return Promise.resolve(where.dataInscricao.gte ? recentes : vencidas);
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      pagamento: { findMany: jest.fn().mockResolvedValue([]) },
      auditLog: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
    };
    pagamentoService = {
      confirmarPagamento: jest.fn().mockResolvedValue({}),
      sincronizarComGateway: jest.fn().mockResolvedValue({}),
    };
    gateway = {
      nome: 'mercadopago',
      buscarPorReferencia: jest.fn().mockResolvedValue([]),
      consultarCobranca: jest.fn().mockResolvedValue(null),
    };
    email = { enviarLembretePagamento: jest.fn() };
    audit = { log: jest.fn() };
    mpOAuth = { obterTokenValido: jest.fn().mockResolvedValue('TOKEN-ORG') };
    return new ExpiracaoInscricaoService(
      prisma,
      pagamentoService,
      mpOAuth,
      email,
      audit,
      gateway,
      { get: () => modo } as any,
    );
  };

  beforeEach(() => {
    for (const nivel of ['log', 'warn', 'error'] as const) {
      jest.spyOn(Logger.prototype, nivel).mockImplementation(() => undefined);
    }
  });
  afterEach(() => jest.restoreAllMocks());

  const naoExpirou = () => expect(prisma.inscricao.updateMany).not.toHaveBeenCalled();

  it('sem a variavel no .env nao faz nada', async () => {
    await criar(undefined, [inscricao()]).executar();
    expect(prisma.inscricao.findMany).not.toHaveBeenCalled();
  });

  it('expira quem nao pagou, so se ainda estiver pendente', async () => {
    await criar('ativo', [inscricao()]).executar();
    expect(prisma.inscricao.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['insc-1'] }, status: 'PENDENTE_PAGAMENTO' },
      data: { status: 'EXPIRADA' },
    });
    // Procura o pedido e a inscricao, na conta do organizador e na nossa.
    expect(gateway.buscarPorReferencia.mock.calls).toEqual([
      ['pedido-1', 'TOKEN-ORG'],
      ['pedido-1', null],
      ['insc-1', 'TOKEN-ORG'],
      ['insc-1', null],
    ]);
  });

  it('busca so pendentes com mais de 24h e nunca importadas', async () => {
    await criar('ativo', []).executar();
    const where = prisma.inscricao.findMany.mock.calls.at(-1)[0].where;
    expect(where).toMatchObject({ status: 'PENDENTE_PAGAMENTO', importacaoId: null });
    expect(Math.abs(where.dataInscricao.lt.getTime() - (Date.now() - 24 * HORA))).toBeLessThan(5000);
  });

  it('simulacao nao altera nada nem manda e-mail', async () => {
    const service = criar('simulacao', [inscricao()], [inscricao()]);
    await service.executar();
    gateway.buscarPorReferencia.mockResolvedValue([achado({ status: 'APROVADO' })]);
    naoExpirou();
    expect(email.enviarLembretePagamento).not.toHaveBeenCalled();
    expect(pagamentoService.sincronizarComGateway).not.toHaveBeenCalled();
    await criarSimulacaoPaga();
  });

  const criarSimulacaoPaga = async () => {
    const service = criar('simulacao', [inscricao()]);
    gateway.buscarPorReferencia.mockResolvedValue([achado({ status: 'APROVADO' })]);
    await service.executar();
    expect(pagamentoService.confirmarPagamento).not.toHaveBeenCalled();
    naoExpirou();
  };

  it('pagou no cartao e o site nao soube: confirma em vez de expirar', async () => {
    const service = criar('ativo', [inscricao()]);
    gateway.buscarPorReferencia.mockResolvedValue([achado({ status: 'APROVADO' })]);
    await service.executar();
    expect(pagamentoService.confirmarPagamento).toHaveBeenCalledWith(
      expect.objectContaining({
        gatewayPaymentId: 'mp-1',
        referenciaExterna: 'pedido-1',
        metodo: 'CARTAO_CREDITO',
      }),
    );
    naoExpirou();
  });

  it.each([
    ['Mercado Pago fora do ar', null],
    ['cartao em analise', [achado()]],
    ['PIX aberto', [achado({ ehPix: true, expiraEm: new Date(Date.now() + HORA) })]],
  ])('%s: nao expira', async (_nome, resposta) => {
    const service = criar('ativo', [inscricao()]);
    gateway.buscarPorReferencia.mockResolvedValue(resposta);
    await service.executar();
    naoExpirou();
  });

  it('PIX vencido expira', async () => {
    const service = criar('ativo', [inscricao()]);
    gateway.buscarPorReferencia.mockResolvedValue([
      achado({ ehPix: true, expiraEm: new Date(Date.now() - HORA) }),
    ]);
    await service.executar();
    expect(prisma.inscricao.updateMany).toHaveBeenCalled();
  });

  it('PIX local ainda valido nao expira nem consulta o gateway', async () => {
    const pix = { status: 'PENDENTE', metodo: 'PIX', expiraEm: new Date(Date.now() + HORA) };
    await criar('ativo', [inscricao({ pedido: { pagamentos: [pix] } })]).executar();
    naoExpirou();
    expect(gateway.buscarPorReferencia).not.toHaveBeenCalled();
  });

  it('cobranca conhecida que o gateway nao devolve: na duvida nao expira', async () => {
    const p = { status: 'PENDENTE', metodo: 'CARTAO_CREDITO', gateway: 'mercadopago', gatewayPaymentId: 'mp-9', pedidoId: 'pedido-1' };
    await criar('ativo', [inscricao({ pedido: { pagamentos: [p] } })]).executar();
    expect(gateway.consultarCobranca).toHaveBeenCalledWith('mp-9', 'TOKEN-ORG');
    naoExpirou();
  });

  it('erro em um pedido nao trava os outros', async () => {
    const service = criar('ativo', [
      inscricao(),
      inscricao({ id: 'insc-2', pedidoId: 'pedido-2' }),
    ]);
    gateway.buscarPorReferencia.mockRejectedValueOnce(new Error('falhou'));
    await service.executar();
    expect(prisma.inscricao.updateMany).toHaveBeenCalledTimes(1);
  });

  describe('lembrete', () => {
    const recente = () => inscricao({ dataInscricao: new Date(Date.now() - 3 * HORA) });

    it('avisa quem tem PIX aberto, uma vez so', async () => {
      const service = criar('ativo', [], [recente()]);
      gateway.buscarPorReferencia.mockResolvedValue([
        achado({ ehPix: true, expiraEm: new Date(Date.now() + HORA) }),
      ]);
      await service.executar();
      expect(email.enviarLembretePagamento).toHaveBeenCalledTimes(1);
      expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);

      prisma.auditLog.findFirst.mockResolvedValue({ id: 'log-1' });
      await service.executar();
      expect(email.enviarLembretePagamento).toHaveBeenCalledTimes(1);
    });

    it('quem ja pagou e confirmado sem receber cobranca', async () => {
      const service = criar('ativo', [], [recente()]);
      gateway.buscarPorReferencia.mockResolvedValue([achado({ status: 'APROVADO' })]);
      await service.executar();
      expect(pagamentoService.confirmarPagamento).toHaveBeenCalled();
      expect(email.enviarLembretePagamento).not.toHaveBeenCalled();
    });

    it('cartao em analise nao recebe cobranca', async () => {
      const service = criar('ativo', [], [recente()]);
      gateway.buscarPorReferencia.mockResolvedValue([achado()]);
      await service.executar();
      expect(email.enviarLembretePagamento).not.toHaveBeenCalled();
    });
  });

  describe('validade do PIX', () => {
    const inscrito = new Date('2026-01-01T10:00:00Z');
    it('vence junto com a vaga', () => {
      expect(validadePix(inscrito, new Date('2026-01-01T20:00:00Z'))).toEqual(
        prazoPagamento(inscrito),
      );
    });
    it('perto do fim ainda dura 35 minutos', () => {
      expect(validadePix(inscrito, new Date('2026-01-02T09:50:00Z'))).toEqual(
        new Date('2026-01-02T10:25:00Z'),
      );
    });
  });
});
