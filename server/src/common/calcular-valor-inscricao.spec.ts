import { calcularValorInscricao } from './calcular-valor-inscricao';
import { TarifaService } from '../pagamento/tarifa.service';

// Auditoria da comissao da plataforma.
//
// Ate aqui a comissao era somada em DOIS lugares: no preco da inscricao
// (`taxaRepassadaAtleta`) e como taxa de servico no pagamento
// (`comissaoPagaPeloAtleta`). Ligados juntos cobravam duas vezes; ligado so o
// primeiro, a comissao saia calculada sobre a base ja inflada e o organizador
// recebia a menos. Estes testes prendem a regra nova: o preco da inscricao nao
// carrega comissao nenhuma, e ela entra uma unica vez, no pagamento.

const COMISSAO = 10; // percentual do organizador nos casos abaixo

function prismaFalso(opcoes: {
  preco: string;
  comissaoPagaPeloAtleta?: boolean;
  aplicaDescontoIdoso?: boolean;
  percentualDescontoIdoso?: number | null;
  camisaOpcional?: boolean;
  valorCamisaOpcional?: number | string | null;
}) {
  return {
    loteModalidadePreco: {
      findUnique: jest.fn().mockResolvedValue({ id: 'preco-1', valor: opcoes.preco }),
    },
    evento: {
      findUnique: jest.fn().mockResolvedValue({
        aplicaDescontoIdoso: opcoes.aplicaDescontoIdoso ?? false,
        percentualDescontoIdoso: opcoes.percentualDescontoIdoso ?? null,
        camisaOpcional: opcoes.camisaOpcional ?? false,
        valorCamisaOpcional: opcoes.valorCamisaOpcional ?? null,
        dataInicio: new Date('2026-12-01'),
        comissaoPagaPeloAtleta: opcoes.comissaoPagaPeloAtleta ?? false,
        // De proposito ligado: e o campo aposentado. O evento que ja existe no
        // banco tem `true` aqui, e o preco tem de sair limpo mesmo assim. Sem
        // esta linha o teste passaria tambem no codigo antigo, sem provar nada.
        taxaRepassadaAtleta: true,
        organizador: { comissaoPercentual: COMISSAO },
      }),
    },
    cupom: { findUnique: jest.fn().mockResolvedValue(null) },
    cliente: { findUnique: jest.fn().mockResolvedValue(null) },
  } as any;
}

const ctx = {
  loteId: 'lote-1',
  modalidadeId: 'modalidade-1',
  clienteId: 'cliente-1',
  eventoId: 'evento-1',
};

describe('auditoria da comissao da plataforma', () => {
  it('o preco da inscricao nao carrega comissao', async () => {
    for (const base of ['20', '70', '150']) {
      const valor = await calcularValorInscricao(prismaFalso({ preco: base }), ctx);
      expect(valor).toBe(Number(base));
    }
  });

  it('nao carrega comissao nem quando o organizador a repassa ao atleta', async () => {
    // O que muda com o repasse e a taxa de servico no pagamento, nunca o preco.
    const valor = await calcularValorInscricao(
      prismaFalso({ preco: '20', comissaoPagaPeloAtleta: true }),
      ctx,
    );
    expect(valor).toBe(20);
  });

  it('desconto do idoso continua valendo sobre o preco', async () => {
    const prisma = prismaFalso({
      preco: '100',
      aplicaDescontoIdoso: true,
      percentualDescontoIdoso: 50,
    });
    const valor = await calcularValorInscricao(prisma, {
      ...ctx,
      dataNascimentoAtleta: new Date('1950-01-01'),
    });
    expect(valor).toBe(50);
  });

  describe('composicao do que o atleta paga e do que o organizador recebe', () => {
    const casos = [20, 70, 150];

    it('organizador absorvendo: atleta paga o preco, comissao sai do repasse', async () => {
      const tarifa = new TarifaService({ get: () => undefined } as any, {
        evento: {
          findUnique: jest.fn().mockResolvedValue({
            comissaoPagaPeloAtleta: false,
            organizador: { comissaoPercentual: COMISSAO },
          }),
        },
      } as any);

      for (const base of casos) {
        const preco = await calcularValorInscricao(
          prismaFalso({ preco: String(base) }),
          ctx,
        );
        const taxaServico = await tarifa.calcularTaxaServico(preco, 'evento-1');
        const atletaPaga = preco + taxaServico;
        const comissao = preco * (COMISSAO / 100);
        const organizadorRecebe = atletaPaga - comissao;

        expect(taxaServico).toBe(0);
        expect(atletaPaga).toBe(base);
        expect(organizadorRecebe).toBeCloseTo(base * 0.9, 2);
      }
    });

    it('atleta pagando: paga preco + comissao, e o organizador recebe o preco CHEIO', async () => {
      const tarifa = new TarifaService({ get: () => undefined } as any, {
        evento: {
          findUnique: jest.fn().mockResolvedValue({
            comissaoPagaPeloAtleta: true,
            organizador: { comissaoPercentual: COMISSAO },
          }),
        },
      } as any);

      for (const base of casos) {
        const preco = await calcularValorInscricao(
          prismaFalso({ preco: String(base), comissaoPagaPeloAtleta: true }),
          ctx,
        );
        const taxaServico = await tarifa.calcularTaxaServico(preco, 'evento-1');
        const atletaPaga = preco + taxaServico;
        const organizadorRecebe = atletaPaga - taxaServico;

        // A comissao sai do preco limpo, nunca de uma base ja inflada: era
        // isso que fazia o organizador receber 99 em vez de 100.
        expect(taxaServico).toBeCloseTo(base * 0.1, 2);
        expect(atletaPaga).toBeCloseTo(base * 1.1, 2);
        expect(organizadorRecebe).toBeCloseTo(base, 2);
      }
    });

    it('o evento de R$ 20 com repasse: atleta paga 22,00 e o organizador recebe 20,00', async () => {
      const tarifa = new TarifaService({ get: () => undefined } as any, {
        evento: {
          findUnique: jest.fn().mockResolvedValue({
            comissaoPagaPeloAtleta: true,
            organizador: { comissaoPercentual: COMISSAO },
          }),
        },
      } as any);

      const preco = await calcularValorInscricao(
        prismaFalso({ preco: '20', comissaoPagaPeloAtleta: true }),
        ctx,
      );
      const taxaServico = await tarifa.calcularTaxaServico(preco, 'evento-1');

      expect(preco).toBe(20);
      expect(taxaServico).toBe(2);
      expect(preco + taxaServico).toBe(22);
      // Antes: base inflava para 22, comissao virava 2,20 e sobravam 19,80.
      expect(preco + taxaServico - taxaServico).toBe(20);
    });
  });

  describe('camisa opcional configurável', () => {
    it('evento com camisa opcional: sem camisa paga apenas valor base (R$ 40)', async () => {
      const valor = await calcularValorInscricao(
        prismaFalso({
          preco: '40',
          camisaOpcional: true,
          valorCamisaOpcional: 40,
        }),
        { ...ctx, incluiCamisa: false },
      );
      expect(valor).toBe(40);
    });

    it('evento com camisa opcional: com camisa soma o adicional (R$ 40 + R$ 40 = R$ 80)', async () => {
      const valor = await calcularValorInscricao(
        prismaFalso({
          preco: '40',
          camisaOpcional: true,
          valorCamisaOpcional: 40,
        }),
        { ...ctx, incluiCamisa: true },
      );
      expect(valor).toBe(80);
    });

    it('evento com camisa opcional e sem desconto idoso: idoso paga valor normal (R$ 40 sem camisa, R$ 80 com camisa)', async () => {
      const idosoNasc = new Date('1950-01-01');
      const valorSemCamisa = await calcularValorInscricao(
        prismaFalso({
          preco: '40',
          camisaOpcional: true,
          valorCamisaOpcional: 40,
          aplicaDescontoIdoso: false,
        }),
        { ...ctx, dataNascimentoAtleta: idosoNasc, incluiCamisa: false },
      );
      expect(valorSemCamisa).toBe(40);

      const valorComCamisa = await calcularValorInscricao(
        prismaFalso({
          preco: '40',
          camisaOpcional: true,
          valorCamisaOpcional: 40,
          aplicaDescontoIdoso: false,
        }),
        { ...ctx, dataNascimentoAtleta: idosoNasc, incluiCamisa: true },
      );
      expect(valorComCamisa).toBe(80);
    });

    it('inscricao ja criada paga o valor da camisa gravado, nao o preco atual do evento', async () => {
      // Atleta pediu com camisa a R$ 40; depois o organizador subiu para R$ 60.
      const valor = await calcularValorInscricao(
        prismaFalso({ preco: '40', camisaOpcional: true, valorCamisaOpcional: 60 }),
        { ...ctx, incluiCamisa: true, valorCamisa: '40' },
      );
      expect(valor).toBe(80);
    });

    it('inscricao ja criada sem valor de camisa gravado nao soma camisa', async () => {
      const valor = await calcularValorInscricao(
        prismaFalso({ preco: '40', camisaOpcional: true, valorCamisaOpcional: 60 }),
        { ...ctx, incluiCamisa: true, valorCamisa: null },
      );
      expect(valor).toBe(40);
    });
  });
});
