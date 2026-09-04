import { TarifaService } from './tarifa.service';
import { MetodoPagamento } from '../generated/prisma/enums';

const svc = new TarifaService({ get: () => undefined } as any, {} as any);

// Lidas do proprio servico: quando estavam copiadas aqui, mudar a tarifa em um
// lugar e esquecer o outro deixava o teste passando com a conta errada.
const TARIFA_PIX = svc.obterTabela().pix.percentual;
const TARIFA_CARTAO = svc.obterTabela().cartao.percentual;

describe('auditoria do repasse da tarifa', () => {
  const casos = [20, 50, 80, 150];

  it('PIX: o que sobra apos a tarifa e o valor da inscricao', () => {
    for (const base of casos) {
      const cobrado = svc.calcularValorCobrado(base, MetodoPagamento.PIX);
      const sobra = cobrado - cobrado * TARIFA_PIX;
      console.log(
        'PIX  base ' + base.toFixed(2) + ' -> atleta paga ' + cobrado.toFixed(2) +
        ' | tarifa ' + (cobrado - base).toFixed(2) + ' | sobra ' + sobra.toFixed(2),
      );
      expect(Math.abs(sobra - base)).toBeLessThan(0.02);
    }
  });

  it('CARTAO: idem', () => {
    for (const base of casos) {
      const cobrado = svc.calcularValorCobrado(base, MetodoPagamento.CARTAO_CREDITO);
      const sobra = cobrado - cobrado * TARIFA_CARTAO;
      console.log(
        'CART base ' + base.toFixed(2) + ' -> atleta paga ' + cobrado.toFixed(2) +
        ' | tarifa ' + (cobrado - base).toFixed(2) + ' | sobra ' + sobra.toFixed(2),
      );
      expect(Math.abs(sobra - base)).toBeLessThan(0.02);
    }
  });

  it('carrinho de varios atletas cobra a tarifa uma vez, como o gateway faz', () => {
    const separado = 3 * svc.calcularValorCobrado(50, MetodoPagamento.PIX);
    const junto = svc.calcularValorCobrado(150, MetodoPagamento.PIX);
    console.log('3 atletas de 50: separado ' + separado.toFixed(2) + ' | junto ' + junto.toFixed(2));
    expect(Math.abs(separado - junto)).toBeLessThan(0.02);
  });

  it('o valor mostrado no Brick e o mesmo que o servidor cobra', () => {
    const noBrick = svc.calcularOpcoesParcelamento(150)[0].total;
    const noServidor = svc.calcularValorCobrado(150, MetodoPagamento.CARTAO_CREDITO, 6);
    console.log('cartao 150 -> Brick ' + noBrick.toFixed(2) + ' | servidor 6x ' + noServidor.toFixed(2));
    expect(noBrick).toBe(noServidor);
  });

  it('divisao completa do dinheiro numa inscricao de R$ 150', () => {
    const base = 150;
    const comissaoPercentual = 10;

    const atletaPaga = svc.calcularValorCobrado(base, MetodoPagamento.PIX);
    const tarifaMp = Number((atletaPaga * 0.0099).toFixed(2));
    const applicationFee = Number((base * (comissaoPercentual / 100)).toFixed(2));
    const organizador = Number((atletaPaga - tarifaMp - applicationFee).toFixed(2));

    console.log('Atleta paga .......... ' + atletaPaga.toFixed(2));
    console.log('Tarifa Mercado Pago .. ' + tarifaMp.toFixed(2));
    console.log('Sua comissao (10%) ... ' + applicationFee.toFixed(2));
    console.log('Organizador recebe ... ' + organizador.toFixed(2));

    // A comissao incide sobre o valor da inscricao, nao sobre o valor cobrado:
    // nao se cobra comissao em cima da tarifa do gateway.
    expect(applicationFee).toBe(15);
    // O organizador fica com o valor da inscricao menos a comissao.
    expect(organizador).toBe(135);
  });

  it('quando o organizador repassa, o atleta paga a comissao e ele recebe o preco cheio', () => {
    const base = 100;
    const comissao = 10;

    // Absorvendo: o atleta paga so a inscricao + tarifa.
    const absorve = svc.calcularValorCobrado(base, MetodoPagamento.PIX);
    const sobraAbsorve = absorve - absorve * 0.0099;
    const organizadorAbsorve = Number((sobraAbsorve - comissao).toFixed(2));

    // Repassando: a comissao entra no valor cobrado como taxa de servico.
    const repassa = svc.calcularValorCobrado(base + comissao, MetodoPagamento.PIX);
    const sobraRepassa = repassa - repassa * 0.0099;
    const organizadorRepassa = Number((sobraRepassa - comissao).toFixed(2));

    console.log('ABSORVE  atleta paga ' + absorve.toFixed(2) + ' | organizador recebe ' + organizadorAbsorve.toFixed(2));
    console.log('REPASSA  atleta paga ' + repassa.toFixed(2) + ' | organizador recebe ' + organizadorRepassa.toFixed(2));

    expect(organizadorAbsorve).toBe(90);
    expect(organizadorRepassa).toBe(100);
    // Nos dois casos a plataforma recebe os mesmos R$ 10.
  });
});
