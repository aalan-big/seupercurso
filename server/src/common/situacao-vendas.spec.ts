import { calcularSituacaoVendas } from './situacao-vendas';

describe('calcularSituacaoVendas', () => {
  const agora = new Date('2026-10-01T12:00:00Z');
  const h = (horas: number) => new Date(agora.getTime() + horas * 3_600_000);

  it('lote dentro da janela: ABERTAS', () => {
    expect(calcularSituacaoVendas([{ inicioVenda: h(-1), fimVenda: h(1) }], agora)).toEqual({
      situacaoVendas: 'ABERTAS',
      vendasAbremEm: null,
    });
  });

  it('so lotes futuros: EM_BREVE com o inicio mais proximo', () => {
    const res = calcularSituacaoVendas(
      [
        { inicioVenda: h(48), fimVenda: h(96) },
        { inicioVenda: h(2), fimVenda: h(40) },
      ],
      agora,
    );
    expect(res).toEqual({ situacaoVendas: 'EM_BREVE', vendasAbremEm: h(2) });
  });

  it('lote aberto ganha de lote futuro', () => {
    const res = calcularSituacaoVendas(
      [
        { inicioVenda: h(-5), fimVenda: h(5) },
        { inicioVenda: h(10), fimVenda: h(20) },
      ],
      agora,
    );
    expect(res.situacaoVendas).toBe('ABERTAS');
  });

  it('entre um lote que fechou e o proximo: EM_BREVE', () => {
    const res = calcularSituacaoVendas(
      [
        { inicioVenda: h(-50), fimVenda: h(-1) },
        { inicioVenda: h(3), fimVenda: h(30) },
      ],
      agora,
    );
    expect(res).toEqual({ situacaoVendas: 'EM_BREVE', vendasAbremEm: h(3) });
  });

  it('todos fecharam: ENCERRADAS', () => {
    expect(
      calcularSituacaoVendas([{ inicioVenda: h(-50), fimVenda: h(-1) }], agora).situacaoVendas,
    ).toBe('ENCERRADAS');
  });

  it('na duvida (sem lote ou data invalida) fica ABERTAS, como antes', () => {
    expect(calcularSituacaoVendas([], agora).situacaoVendas).toBe('ABERTAS');
    expect(calcularSituacaoVendas(undefined, agora).situacaoVendas).toBe('ABERTAS');
    expect(
      calcularSituacaoVendas([{ inicioVenda: 'lixo', fimVenda: 'lixo' }], agora).situacaoVendas,
    ).toBe('ABERTAS');
  });

  it('aceita as datas como texto (JSON)', () => {
    expect(
      calcularSituacaoVendas(
        [{ inicioVenda: h(1).toISOString(), fimVenda: h(9).toISOString() }],
        agora,
      ).situacaoVendas,
    ).toBe('EM_BREVE');
  });
});
