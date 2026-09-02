import { TarifaService } from '../src/pagamento/tarifa.service';
import { MetodoPagamento } from '../src/generated/prisma/enums';

const svc = new TarifaService({ get: () => undefined } as any);

describe('repasse da tarifa ao atleta', () => {
  const casos = [20, 50, 80, 150];

  it('PIX: o que sobra apos a tarifa e exatamente o valor da inscricao', () => {
    for (const base of casos) {
      const cobrado = svc.calcularValorCobrado(base, MetodoPagamento.PIX);
      const tarifaMp = cobrado * 0.0099;
      const sobra = cobrado - tarifaMp;
      console.log(
        `PIX  base ${base.toFixed(2)} -> atleta paga ${cobrado.toFixed(2)} | tarifa ${(cobrado - base).toFixed(2)} | sobra ${sobra.toFixed(2)}`,
      );
      expect(Math.abs(sobra - base)).toBeLessThan(0.02);
    }
  });

  it('CARTAO: idem', () => {
    for (const base of casos) {
      const cobrado = svc.calcularValorCobrado(base, MetodoPagamento.CARTAO_CREDITO);
      const tarifaMp = cobrado * 0.0398;
      const sobra = cobrado - tarifaMp;
      console.log(
        `CART base ${base.toFixed(2)} -> atleta paga ${cobrado.toFixed(2)} | tarifa ${(cobrado - base).toFixed(2)} | sobra ${sobra.toFixed(2)}`,
      );
      expect(Math.abs(sobra - base)).toBeLessThan(0.02);
    }
  });

  it('carrinho com varios atletas cobra a tarifa uma vez so, como o gateway faz', () => {
    const individual = 3 * svc.calcularValorCobrado(50, MetodoPagamento.PIX);
    const emLote = svc.calcularValorCobrado(150, MetodoPagamento.PIX);
    console.log(`3 atletas de 50: separado ${individual.toFixed(2)} | junto ${emLote.toFixed(2)}`);
    expect(Math.abs(individual - emLote)).toBeLessThan(0.02);
  });

  it('parcelamento nao muda o valor cobrado com a config atual', () => {
    const umaVez = svc.calcularValorCobrado(150, MetodoPagamento.CARTAO_CREDITO, 1);
    const seisVezes = svc.calcularValorCobrado(150, MetodoPagamento.CARTAO_CREDITO, 6);
    console.log(`cartao 150 -> 1x ${umaVez.toFixed(2)} | 6x ${seisVezes.toFixed(2)}`);
    expect(umaVez).toBe(seisVezes);
  });
});
