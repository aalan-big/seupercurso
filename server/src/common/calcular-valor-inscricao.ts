import { PrismaService } from '../prisma/prisma.service';
import { resolverPreco } from './resolver-preco';
import { resolverDescontoPerfil } from './desconto-perfil';

interface ContextoValor {
  loteId: string;
  modalidadeId: string;
  clienteId: string;
  eventoId: string;
  cupomId?: string | null;
  dataNascimentoAtleta?: Date | null;
  /**
   * Atleta PCD para o desconto PCD do evento. No pagamento vem de
   * Inscricao.descontoPcd (o que valeu na criacao, com documento), nao do
   * cadastro: marcar PCD depois nao baixa o preco de um pedido ja criado.
   */
  atletaPcd?: boolean;
  incluiCamisa?: boolean;
  /**
   * Valor da camisa gravado na inscricao. Quando informado (inclusive null),
   * vale ele e nao o preco atual do evento: se o organizador muda o preco
   * entre o pedido e o pagamento, o atleta paga o que viu na tela.
   */
  valorCamisa?: number | string | { toString(): string } | null;
  /**
   * Desconto de funcionario gravado na inscricao (Inscricao.percentualFuncionario).
   * Vale so sobre a inscricao (a camisa opcional sai cheia) e nao acumula com
   * idoso nem cupom. O percentual e o gravado, nao o atual do evento: o atleta
   * paga o que viu na tela.
   */
  percentualFuncionario?: number | string | { toString(): string } | null;
}

export interface ValoresInscricao {
  /** O que o atleta paga pela inscricao (sem a taxa do site). */
  valor: number;
  /**
   * Base sobre a qual sai a taxa do site: o valor que o atleta paga, cupom
   * parcial incluido (evento de R$ 70 com cupom de 10% = taxa sobre R$ 63).
   * Excecao: cupom de 100% zeraria a taxa junto, entao nele a taxa sai do preco
   * antes do cupom e o atleta paga so ela. So o cupom de cortesia liberado pelo
   * admin (`Cupom.cortesiaSemTaxa`) entra sem taxa nenhuma.
   */
  baseComissao: number;
}

export async function calcularValorInscricao(
  prisma: PrismaService,
  ctx: ContextoValor,
): Promise<number> {
  return (await calcularValoresInscricao(prisma, ctx)).valor;
}

export async function calcularValoresInscricao(
  prisma: PrismaService,
  ctx: ContextoValor,
): Promise<ValoresInscricao> {
  const preco = await resolverPreco(prisma, ctx.loteId, ctx.modalidadeId);
  let valor = Number(preco.valor);

  const evento = await prisma.evento.findUnique({
    where: { id: ctx.eventoId },
    select: {
      aplicaDescontoIdoso: true,
      percentualDescontoIdoso: true,
      aplicaDescontoPcd: true,
      percentualDescontoPcd: true,
      dataInicio: true,
      camisaOpcional: true,
      valorCamisaOpcional: true,
    },
  });

  const percentualFuncionario = Number(ctx.percentualFuncionario ?? 0);

  if (percentualFuncionario > 0) {
    valor -= valor * (percentualFuncionario / 100);
  } else if (evento) {
    // Idoso ou PCD, o maior (nao acumulam). Mesma regra da criacao.
    let dataNasc: Date | null = ctx.dataNascimentoAtleta || null;
    if (!dataNasc && evento.aplicaDescontoIdoso && evento.percentualDescontoIdoso) {
      const cliente = await prisma.cliente.findUnique({
        where: { id: ctx.clienteId },
        include: { pf: true },
      });
      dataNasc = cliente?.pf?.dataNascimento || null;
    }

    const desconto = resolverDescontoPerfil(evento, {
      dataNascimento: dataNasc,
      pcd: !!ctx.atletaPcd,
    });
    if (desconto) {
      valor -= valor * (desconto.percentual / 100);
    }
  }

  let descontoCupom = 0;
  let cupomZeraInscricao = false;
  if (ctx.cupomId && percentualFuncionario <= 0) {
    const cupom = await prisma.cupom.findUnique({ where: { id: ctx.cupomId } });
    if (cupom?.ativo) {
      descontoCupom = valor * (Number(cupom.percentualDesconto) / 100);
      cupomZeraInscricao =
        Number(cupom.percentualDesconto) >= 100 && !cupom.cortesiaSemTaxa;
    }
  }
  const valorSemCupom = valor;
  valor -= descontoCupom;

  // Camisa opcional escolhida pelo participante. A inscricao ja criada traz o
  // valor gravado; sem ele (pedido sendo montado), vale o preco do evento.
  let camisa = 0;
  if (ctx.valorCamisa !== undefined) {
    if (ctx.incluiCamisa && ctx.valorCamisa !== null) {
      camisa = Number(ctx.valorCamisa);
    }
  } else if (evento?.camisaOpcional && ctx.incluiCamisa && evento.valorCamisaOpcional) {
    camisa = Number(evento.valorCamisaOpcional);
  }
  valor += camisa;

  // A comissao da plataforma NAO entra aqui. Esta funcao devolve so o preco da
  // inscricao; quem paga a comissao e decidido no pagamento, por
  // `Evento.comissaoPagaPeloAtleta`, e somada la como taxa de servico. Somar
  // aqui inflava a base sobre a qual a propria comissao era calculada.
  const valorFinal = Math.max(0, Number(valor.toFixed(2)));
  // Taxa sobre o que o atleta paga; so o cupom de 100% (sem cortesia do admin)
  // usa o preco antes do cupom, para a inscricao nao sair sem a taxa do site.
  const baseComissao = cupomZeraInscricao
    ? Math.max(0, Number((valorSemCupom + camisa).toFixed(2)))
    : valorFinal;
  return { valor: valorFinal, baseComissao };
}
