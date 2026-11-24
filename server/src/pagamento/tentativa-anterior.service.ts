import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StatusInscricao, StatusPagamento } from '../generated/prisma/enums';
import {
  ExpiracaoInscricaoService,
  type Grupo,
  type PixAberto,
} from './expiracao-inscricao.service';
import { GATEWAY_PAGAMENTO, type GatewayPagamento } from './gateway.port';

const TENTE_DE_NOVO =
  'Não conseguimos conferir sua tentativa de pagamento anterior agora. Aguarde um instante e tente de novo, para não ser cobrado duas vezes.';
const CPF_DO_ATLETA = {
  atletaCpf: true,
  dependenteId: true,
  dependente: { select: { cpf: true } },
  cliente: { select: { pf: { select: { cpf: true } } } },
} as const;

interface ItemCarrinho {
  categoriaId: string;
  dependenteId?: string;
  atleta?: { cpf: string };
}

export interface Substituicao {
  /** Inscricoes nao pagas que a compra nova substitui. */
  ids: string[];
  pixAbertos: PixAberto[];
  eventoIds: string[];
  cpfs: string[];
  /** Pendentes do mesmo atleta que ja existiam e ficam como estao. */
  mantidas: string[];
}

const SEM_SUBSTITUICAO: Substituicao = {
  ids: [],
  pixAbertos: [],
  eventoIds: [],
  cpfs: [],
  mantidas: [],
};

const digitos = (cpf?: string | null) => (cpf ?? '').replace(/\D/g, '');

function cpfDoAtleta(i: {
  atletaCpf: string | null;
  dependenteId: string | null;
  dependente: { cpf: string } | null;
  cliente: { pf: { cpf: string } | null };
}) {
  return digitos(
    i.atletaCpf ||
      i.dependente?.cpf ||
      (i.dependenteId ? null : i.cliente.pf?.cpf),
  );
}

/**
 * Comprar de novo substitui a tentativa nao paga do mesmo atleta. Antes cada
 * clique em pagar criava outro pedido: uma pessoa segurava varias vagas e o PIX
 * antigo continuava pagavel, com risco de pagar duas vezes.
 */
@Injectable()
export class TentativaAnteriorService {
  private readonly logger = new Logger(TentativaAnteriorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly expiracao: ExpiracaoInscricaoService,
    @Inject(GATEWAY_PAGAMENTO) private readonly gateway: GatewayPagamento,
  ) {}

  /** Decide o que sera substituido. Nao altera nada, a nao ser confirmar o que ja foi pago. */
  async avaliar(
    cliente: { id: string; pf?: { cpf: string } | null },
    itens: ItemCarrinho[],
  ): Promise<Substituicao> {
    const categorias = await this.prisma.categoria.findMany({
      where: { id: { in: itens.map((i) => i.categoriaId) } },
      select: { modalidade: { select: { eventoId: true } } },
    });
    const eventoIds = [...new Set(categorias.map((c) => c.modalidade.eventoId))];
    if (eventoIds.length === 0) return SEM_SUBSTITUICAO;

    const dependentes = await this.prisma.dependente.findMany({
      where: {
        clienteId: cliente.id,
        id: { in: itens.flatMap((i) => (i.dependenteId ? [i.dependenteId] : [])) },
      },
      select: { id: true, cpf: true },
    });
    const cpfs = itens
      .map((i) =>
        digitos(
          i.dependenteId
            ? dependentes.find((d) => d.id === i.dependenteId)?.cpf
            : (i.atleta?.cpf ?? cliente.pf?.cpf),
        ),
      )
      .filter(Boolean);

    const base = { eventoIds, cpfs };
    const pendentes = await this.expiracao.buscarInscricoes({
      clienteId: cliente.id,
      categoria: { modalidade: { eventoId: { in: eventoIds } } },
    });
    if (!pendentes.some((p) => cpfs.includes(cpfDoAtleta(p)))) {
      return { ...SEM_SUBSTITUICAO, ...base };
    }

    const grupos = new Map<string, Grupo>();
    for (const p of pendentes) {
      const chave = p.pedidoId ?? p.id;
      grupos.set(chave, [...(grupos.get(chave) ?? []), p]);
    }

    const ids: string[] = [];
    const mantidas: string[] = [];
    const pixAbertos: PixAberto[] = [];
    for (const grupo of grupos.values()) {
      const doCarrinho = grupo.filter((i) => cpfs.includes(cpfDoAtleta(i)));
      if (doCarrinho.length === 0) continue;

      const situacao = await this.expiracao.verificar(grupo, true);
      if (situacao.tipo === 'PAGO') {
        await this.expiracao.confirmar(situacao.pagamento);
        throw new ConflictException(
          'Identificamos o pagamento da sua tentativa anterior. Não pague de novo: confira em "Minhas Inscrições".',
        );
      }
      if (situacao.tipo === 'AGUARDAR') {
        throw new ConflictException(
          situacao.emAndamento
            ? 'Seu pagamento anterior está em análise. Aguarde a confirmação antes de tentar de novo, para não ser cobrado duas vezes.'
            : TENTE_DE_NOVO,
        );
      }

      // Pedido com outros atletas, que nao estao nesta compra: cancelar o PIX
      // deixaria os outros sem como pagar.
      if (doCarrinho.length < grupo.length) {
        mantidas.push(...doCarrinho.map((i) => i.id));
        continue;
      }
      ids.push(...grupo.map((i) => i.id));
      pixAbertos.push(...situacao.pixAbertos);
    }

    return { ...base, ids, mantidas, pixAbertos };
  }

  /**
   * Ultimo passo antes de gravar a compra nova. Sem confirmar o cancelamento a
   * compra para: o codigo antigo ainda poderia ser pago.
   */
  async cancelarPix(substituicao: Substituicao) {
    for (const pix of substituicao.pixAbertos) {
      if (!(await this.gateway.cancelarCobranca(pix.gatewayPaymentId, pix.token))) {
        this.logger.warn(`PIX ${pix.gatewayPaymentId} não pôde ser cancelado.`);
        throw new ConflictException(TENTE_DE_NOVO);
      }
      await this.prisma.pagamento.updateMany({
        where: {
          gatewayPaymentId: pix.gatewayPaymentId,
          status: StatusPagamento.PENDENTE,
        },
        data: { status: StatusPagamento.CANCELADO },
      });
    }
  }

  /** Dentro da transacao da compra: uma compra por vez para cada comprador. */
  async substituir(tx: any, clienteId: string, s: Substituicao) {
    if (s.eventoIds.length === 0) return;
    const chave = `compra:${clienteId}`;
    await tx.$queryRaw`SELECT 1 FROM (SELECT pg_advisory_xact_lock(hashtext(${chave}))) AS trava`;

    if (s.ids.length > 0) {
      const { count } = await tx.inscricao.updateMany({
        where: {
          id: { in: s.ids },
          status: StatusInscricao.PENDENTE_PAGAMENTO,
        },
        data: { status: StatusInscricao.CANCELADA },
      });
      // Alguma foi paga ou mudou depois da conferencia.
      if (count !== s.ids.length) throw new ConflictException(TENTE_DE_NOVO);
    }

    // Outra aba comprou o mesmo enquanto esta conferia.
    const novas = await tx.inscricao.findMany({
      where: {
        clienteId,
        importacaoId: null,
        status: {
          in: [StatusInscricao.PENDENTE_PAGAMENTO, StatusInscricao.CONFIRMADA],
        },
        categoria: { modalidade: { eventoId: { in: s.eventoIds } } },
        id: { notIn: s.mantidas },
      },
      select: CPF_DO_ATLETA,
    });
    if (novas.some((n: any) => s.cpfs.includes(cpfDoAtleta(n)))) {
      throw new ConflictException(
        'Esta inscrição acabou de ser feita em outra tentativa. Confira em "Minhas Inscrições".',
      );
    }
  }
}
