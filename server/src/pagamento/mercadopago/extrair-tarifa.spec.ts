import { extrairTarifaMercadoPago } from './mercadopago.service';

describe('extrairTarifaMercadoPago', () => {
  it('conta a tarifa do Mercado Pago e ignora a nossa comissao (application_fee)', () => {
    // Venda real de cartao: 49,23 com comissao de 4,00. Somando a comissao o
    // gross-up aprendia 10,6% em vez de ~2,5%.
    const tarifa = extrairTarifaMercadoPago({
      fee_details: [
        { type: 'mercadopago_fee', amount: 1.23, fee_payer: 'collector' },
        { type: 'application_fee', amount: 4, fee_payer: 'collector' },
      ],
    });
    expect(tarifa).toBe(1.23);
  });

  it('juros de parcelamento pagos pelo comprador nao entram', () => {
    const tarifa = extrairTarifaMercadoPago({
      fee_details: [
        { type: 'mercadopago_fee', amount: 2.5, fee_payer: 'collector' },
        { type: 'financing_fee', amount: 9, fee_payer: 'payer' },
      ],
    });
    expect(tarifa).toBe(2.5);
  });

  it('sem tarifa informada devolve null', () => {
    expect(extrairTarifaMercadoPago({ fee_details: [] })).toBeNull();
    expect(
      extrairTarifaMercadoPago({
        fee_details: [{ type: 'application_fee', amount: 4, fee_payer: 'collector' }],
      }),
    ).toBeNull();
    expect(extrairTarifaMercadoPago({})).toBeNull();
  });
});
