import { tarifaGatewayDoPagamento } from './tarifa-pagamento';

describe('tarifaGatewayDoPagamento', () => {
  it('PIX do Mercado Pago: tira a comissao do que o liquido descontou', () => {
    // Inscricao de 40 + comissao 4, gross-up de 0,99%: o organizador recebe 40.
    const tarifa = tarifaGatewayDoPagamento({
      gateway: 'mercadopago',
      valor: '44.44',
      valorLiquido: '40.00',
      taxaGateway: '4.44', // gravado antes: comissao + tarifa
      comissaoPlataforma: '4.00',
    });
    expect(tarifa).toBe(0.44);
  });

  it('sem liquido usa a tarifa gravada', () => {
    expect(
      tarifaGatewayDoPagamento({
        gateway: 'mercadopago',
        valor: 46.31,
        taxaGateway: 2.31,
        comissaoPlataforma: 4,
      }),
    ).toBe(2.31);
  });

  it('cartao antigo sem nada gravado devolve 0', () => {
    expect(
      tarifaGatewayDoPagamento({
        gateway: 'mercadopago',
        valor: 49.23,
        comissaoPlataforma: 4,
      }),
    ).toBe(0);
  });

  it('outro gateway mantem a tarifa gravada', () => {
    expect(
      tarifaGatewayDoPagamento({
        gateway: 'asaas',
        valor: 100,
        valorLiquido: 97,
        taxaGateway: 3,
        comissaoPlataforma: 10,
      }),
    ).toBe(3);
  });

  it('nunca devolve tarifa negativa', () => {
    expect(
      tarifaGatewayDoPagamento({
        gateway: 'mercadopago',
        valor: 50,
        valorLiquido: 50,
        comissaoPlataforma: 0,
      }),
    ).toBe(0);
  });
});
