import { ConflictException, Logger } from '@nestjs/common';
import { TentativaAnteriorService } from './tentativa-anterior.service';

describe('TentativaAnteriorService', () => {
  let prisma: any;
  let expiracao: any;
  let gateway: any;
  let service: TentativaAnteriorService;

  const cliente = { id: 'cliente-1', pf: { cpf: '11111111111' } };
  const itens = [{ categoriaId: 'cat-1' }];
  const pendente = (extras: object = {}) => ({
    id: 'insc-1',
    pedidoId: 'pedido-1',
    atletaCpf: '11111111111',
    dependenteId: null,
    dependente: null,
    cliente,
    ...extras,
  });
  const pix = { gatewayPaymentId: 'mp-1', token: 'TOKEN' };

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    prisma = {
      categoria: {
        findMany: jest.fn().mockResolvedValue([{ modalidade: { eventoId: 'evento-1' } }]),
      },
      dependente: { findMany: jest.fn().mockResolvedValue([]) },
      pagamento: { updateMany: jest.fn() },
    };
    expiracao = {
      buscarInscricoes: jest.fn().mockResolvedValue([pendente()]),
      verificar: jest.fn().mockResolvedValue({ tipo: 'NAO_PAGO', pixAbertos: [pix] }),
      confirmar: jest.fn(),
    };
    gateway = { cancelarCobranca: jest.fn().mockResolvedValue(true) };
    service = new TentativaAnteriorService(prisma, expiracao, gateway);
  });
  afterEach(() => jest.restoreAllMocks());

  it('primeira compra nao consulta o gateway', async () => {
    expiracao.buscarInscricoes.mockResolvedValue([]);
    const s = await service.avaliar(cliente, itens);
    expect(s.ids).toEqual([]);
    expect(expiracao.verificar).not.toHaveBeenCalled();
  });

  it('nao paga: marca para substituir sem cancelar nada ainda', async () => {
    const s = await service.avaliar(cliente, itens);
    expect(s.ids).toEqual(['insc-1']);
    expect(s.pixAbertos).toEqual([pix]);
    expect(gateway.cancelarCobranca).not.toHaveBeenCalled();
  });

  it('ja paga: confirma e nao deixa comprar de novo', async () => {
    expiracao.verificar.mockResolvedValue({ tipo: 'PAGO', pagamento: { gatewayPaymentId: 'x' } });
    await expect(service.avaliar(cliente, itens)).rejects.toThrow(/Não pague de novo/);
    expect(expiracao.confirmar).toHaveBeenCalledWith({ gatewayPaymentId: 'x' });
  });

  it('cartao em analise: pede para aguardar', async () => {
    expiracao.verificar.mockResolvedValue({ tipo: 'AGUARDAR', motivo: '', emAndamento: true });
    await expect(service.avaliar(cliente, itens)).rejects.toThrow(/em análise/);
  });

  it('gateway sem resposta: pede para tentar de novo', async () => {
    expiracao.verificar.mockResolvedValue({ tipo: 'AGUARDAR', motivo: '' });
    await expect(service.avaliar(cliente, itens)).rejects.toThrow(/tente de novo/);
  });

  it('comprar para outra pessoa nao mexe na pendente do comprador', async () => {
    const s = await service.avaliar(cliente, [
      { categoriaId: 'cat-1', atleta: { cpf: '222.222.222-22' } },
    ]);
    expect(s.ids).toEqual([]);
    expect(expiracao.verificar).not.toHaveBeenCalled();
  });

  it('reconhece o dependente pelo CPF', async () => {
    prisma.dependente.findMany.mockResolvedValue([{ id: 'dep-1', cpf: '33333333333' }]);
    expiracao.buscarInscricoes.mockResolvedValue([
      pendente({ atletaCpf: null, dependenteId: 'dep-1', dependente: { cpf: '33333333333' } }),
    ]);
    const s = await service.avaliar(cliente, [{ categoriaId: 'cat-1', dependenteId: 'dep-1' }]);
    expect(s.ids).toEqual(['insc-1']);
  });

  it('pedido em grupo com atleta fora da compra fica como esta', async () => {
    expiracao.buscarInscricoes.mockResolvedValue([
      pendente(),
      pendente({ id: 'insc-2', atletaCpf: '22222222222' }),
    ]);
    const s = await service.avaliar(cliente, itens);
    expect(s).toMatchObject({ ids: [], pixAbertos: [], mantidas: ['insc-1'] });
  });

  it('cancela o PIX no gateway e aqui', async () => {
    await service.cancelarPix(await service.avaliar(cliente, itens));
    expect(gateway.cancelarCobranca).toHaveBeenCalledWith('mp-1', 'TOKEN');
    expect(prisma.pagamento.updateMany).toHaveBeenCalledWith({
      where: { gatewayPaymentId: 'mp-1', status: 'PENDENTE' },
      data: { status: 'CANCELADO' },
    });
  });

  it('PIX que nao pode ser cancelado para a compra', async () => {
    gateway.cancelarCobranca.mockResolvedValue(false);
    const s = await service.avaliar(cliente, itens);
    await expect(service.cancelarPix(s)).rejects.toThrow(ConflictException);
    expect(prisma.pagamento.updateMany).not.toHaveBeenCalled();
  });

  describe('substituir', () => {
    const criarTx = (count = 1, novas: any[] = []) => ({
      $queryRaw: jest.fn(),
      inscricao: {
        updateMany: jest.fn().mockResolvedValue({ count }),
        findMany: jest.fn().mockResolvedValue(novas),
      },
    });

    it('cancela so as que seguem pendentes', async () => {
      const tx = criarTx();
      await service.substituir(tx, 'cliente-1', await service.avaliar(cliente, itens));
      expect(tx.$queryRaw).toHaveBeenCalled();
      expect(tx.inscricao.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['insc-1'] }, status: 'PENDENTE_PAGAMENTO' },
        data: { status: 'CANCELADA' },
      });
    });

    it('antiga confirmada no meio do caminho: desfaz a compra nova', async () => {
      const s = await service.avaliar(cliente, itens);
      await expect(service.substituir(criarTx(0), 'cliente-1', s)).rejects.toThrow(ConflictException);
    });

    it('outra aba comprou o mesmo atleta: desfaz a compra nova', async () => {
      expiracao.buscarInscricoes.mockResolvedValue([]);
      const s = await service.avaliar(cliente, itens);
      await expect(
        service.substituir(criarTx(0, [pendente({ id: 'insc-9' })]), 'cliente-1', s),
      ).rejects.toThrow(/outra tentativa/);
    });

    it('pendente de outro atleta nao atrapalha', async () => {
      expiracao.buscarInscricoes.mockResolvedValue([]);
      const s = await service.avaliar(cliente, itens);
      await service.substituir(
        criarTx(0, [pendente({ id: 'insc-9', atletaCpf: '22222222222' })]),
        'cliente-1',
        s,
      );
    });
  });
});
