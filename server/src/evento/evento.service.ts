import { Injectable, NotFoundException } from '@nestjs/common';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { StatusEvento, StatusInscricao } from '../generated/prisma/enums';
import { contarUsosCupom } from '../common/contar-usos-cupom';
import { calcularSituacaoVendas } from '../common/situacao-vendas';
import { filtroVagaGratuitaEmUso } from '../common/evento-gratuito';

const RESUMO_SELECT = {
  id: true,
  nome: true,
  descricao: true,
  dataInicio: true,
  dataFim: true,
  local: true,
  cidade: true,
  estado: true,
  capacidade: true,
  status: true,
  regulamentoUrl: true,
  bannerUrl: true,
  possuiCamisa: true,
  camisaOpcional: true,
  valorCamisaOpcional: true,
  aceitaPix: true,
  aceitaCartao: true,
  comissaoPagaPeloAtleta: true,
  // O site precisa saber do desconto do idoso para mostrar o preco certo e
  // pedir o documento de quem tem 60+; sem isso o servidor recusava a
  // inscricao e o atleta nao conseguia pagar.
  aplicaDescontoIdoso: true,
  percentualDescontoIdoso: true,
  aplicaDescontoPcd: true,
  percentualDescontoPcd: true,
  permiteServidorPublico: true,
  vagasServidorPublico: true,
  eventoGratuito: true,
  vagasEventoGratuito: true,
  tipoEsporte: true,
  // Desconto para funcionarios: o site mostra o campo do contrato e o preco.
  permiteFuncionarios: true,
  percentualFuncionarios: true,
  nomeEmpresaFuncionarios: true,
} as const;

const FORMATO_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class EventoService {
  constructor(private readonly prisma: PrismaService) {}

  /** Caminho no disco da moldura "Eu vou"; só arquivos da pasta de eventos. */
  async arquivoMolduraEuVou(eventoId: string): Promise<string> {
    if (!FORMATO_UUID.test(eventoId)) {
      throw new NotFoundException('Moldura não encontrada.');
    }
    const evento = await this.prisma.evento.findUnique({
      where: { id: eventoId },
      select: { molduraEuVouUrl: true },
    });
    const caminho = evento?.molduraEuVouUrl;
    if (!caminho || !caminho.startsWith('/uploads/eventos/') || caminho.includes('..')) {
      throw new NotFoundException('Moldura não encontrada.');
    }
    return join(process.cwd(), caminho);
  }

  async validarCupom(eventoId: string, codigo: string, usuarioId?: string | null) {
    const codigoLimpo = (codigo || '').trim();
    if (!codigoLimpo) {
      throw new NotFoundException('Informe o código do cupom.');
    }

    const cupom = await this.prisma.cupom.findFirst({
      where: {
        eventoId,
        codigo: { equals: codigoLimpo, mode: 'insensitive' },
      },
    });

    if (!cupom) {
      throw new NotFoundException(`Cupom "${codigoLimpo}" não encontrado para este evento.`);
    }

    if (!cupom.ativo) {
      throw new NotFoundException('Este cupom está inativo no momento.');
    }

    if (cupom.validoAte && cupom.validoAte < new Date()) {
      throw new NotFoundException('Este cupom expirou.');
    }

    const cliente = usuarioId
      ? await this.prisma.cliente.findUnique({
          where: { usuarioId },
          select: { id: true },
        })
      : null;
    const usosEfetivos = await contarUsosCupom(this.prisma, cupom.id, cliente?.id);

    if (
      cupom.quantidadeMaxima !== null &&
      usosEfetivos >= cupom.quantidadeMaxima
    ) {
      throw new NotFoundException('Este cupom já atingiu o limite de usos.');
    }

    return {
      valido: true,
      codigo: cupom.codigo,
      percentualDesconto: Number(cupom.percentualDesconto),
    };
  }

  async findPublicados() {
    const agora = new Date();

    const eventos = await this.prisma.evento.findMany({
      where: {
        status: {
          in: [
            StatusEvento.PUBLICADO,
            StatusEvento.INSCRICOES_ENCERRADAS,
            StatusEvento.FINALIZADO,
          ],
        },
      },
      select: {
        ...RESUMO_SELECT,
        lotes: {
          select: {
            inicioVenda: true,
            fimVenda: true,
            precos: { select: { valor: true } },
          },
        },
      },
      // Mais recente cadastrado primeiro na vitrine do site
      orderBy: { createdAt: 'desc' },
    });

    const lotados = await this.eventosGratuitosLotados(eventos);

    return eventos.map(({ lotes, ...eventoOriginal }) => {
      const evento = lotados.has(eventoOriginal.id)
        ? { ...eventoOriginal, status: StatusEvento.INSCRICOES_ENCERRADAS }
        : eventoOriginal;
      // 1. Tenta pegar preços dos lotes vigentes no momento atual deste evento
      const lotesVigentes = (lotes || []).filter((l) => {
        const inicio = new Date(l.inicioVenda);
        const fim = new Date(l.fimVenda);
        return inicio <= agora && fim >= agora;
      });

      let valores = lotesVigentes.flatMap((lote) =>
        (lote.precos || []).map((preco) => Number(preco.valor)),
      ).filter((v) => !isNaN(v) && v > 0);

      // 2. Se não houver lote vigente no momento exato, pega o menor preço de qualquer lote cadastrado deste evento
      if (valores.length === 0 && lotes) {
        valores = lotes.flatMap((lote) =>
          (lote.precos || []).map((preco) => Number(preco.valor)),
        ).filter((v) => !isNaN(v) && v > 0);
      }

      return {
        ...evento,
        valorApartirDe: evento.eventoGratuito
          ? 0
          : valores.length > 0
            ? Math.min(...valores)
            : null,
        // So faz sentido para evento publicado; esgotado/finalizado ja tem aviso proprio
        ...(evento.status === StatusEvento.PUBLICADO
          ? calcularSituacaoVendas(lotes, agora)
          : { situacaoVendas: null, vendasAbremEm: null }),
      };
    });
  }

  /**
   * Eventos gratuitos publicados que ja usaram todas as vagas gratuitas. O site
   * inteiro trata "esgotado" pelo status INSCRICOES_ENCERRADAS (card, ordem da
   * home, pagina do evento); a API so informa assim, sem gravar no banco, e
   * uma vaga devolvida por cancelamento reabre o evento sozinha.
   */
  private async eventosGratuitosLotados(
    eventos: Array<{
      id: string;
      status: StatusEvento;
      eventoGratuito: boolean;
      vagasEventoGratuito: number | null;
    }>,
  ): Promise<Set<string>> {
    const comLimite = eventos.filter(
      (e) =>
        e.eventoGratuito &&
        e.vagasEventoGratuito !== null &&
        e.status === StatusEvento.PUBLICADO,
    );
    const lotados = new Set<string>();
    for (const evento of comLimite) {
      const usadas = await this.prisma.inscricao.count({
        where: filtroVagaGratuitaEmUso(evento.id),
      });
      if (usadas >= evento.vagasEventoGratuito!) lotados.add(evento.id);
    }
    return lotados;
  }

  async findOneDetalhado(id: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    let targetId = id;
    if (!isUuid) {
      const todosEventos = await this.prisma.evento.findMany({
        where: {
          status: {
            in: [
              StatusEvento.PUBLICADO,
              StatusEvento.INSCRICOES_ENCERRADAS,
              StatusEvento.FINALIZADO,
            ],
          },
        },
        select: { id: true },
      });
      const encontrado = todosEventos.find((e) => e.id.toLowerCase().startsWith(id.toLowerCase()));
      if (encontrado) {
        targetId = encontrado.id;
      }
    }

    const evento = await this.prisma.evento.findFirst({
      where: {
        id: targetId,
        status: {
          in: [
            StatusEvento.PUBLICADO,
            StatusEvento.INSCRICOES_ENCERRADAS,
            StatusEvento.FINALIZADO,
          ],
        },
      },
      select: {
        ...RESUMO_SELECT,
        retiradaKitLocal: true,
        retiradaKitInicio: true,
        retiradaKitFim: true,
        // Arte "Eu vou" aberta a qualquer visitante da pagina, como divulgacao.
        molduraEuVouUrl: true,
        // So nome e celular do organizador, para a pagina do evento. Nada de
        // documento ou dado bancario: o objeto inteiro sai daqui ja achatado.
        organizador: {
          select: {
            cliente: {
              select: {
                pf: { select: { nomeCompleto: true, celular: true } },
                pj: {
                  select: {
                    nomeFantasia: true,
                    razaoSocial: true,
                    celularComercial: true,
                  },
                },
              },
            },
          },
        },
        modalidades: {
          select: {
            id: true,
            nome: true,
            distanciaKm: true,
            descricao: true,
            idadeMinima: true,
            idadeMaxima: true,
            ativo: true,
            capacidade: true,
            mapaPercursoUrl: true,
            mapaEmbedUrl: true,
            gpxUrl: true,
            rotaGeoJson: true,
            categorias: {
              select: {
                id: true,
                nome: true,
                idadeMinima: true,
                idadeMaxima: true,
                genero: true,
                pcd: true,
                servidorPublico: true,
                capacidade: true,
                _count: {
                  select: {
                    inscricoes: {
                      where: {
                        status: {
                          notIn: [
                            StatusInscricao.CANCELADA,
                            StatusInscricao.EXPIRADA,
                          ],
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        lotes: {
          select: {
            id: true,
            nome: true,
            quantidade: true,
            inicioVenda: true,
            fimVenda: true,
            precos: {
              select: { id: true, modalidadeId: true, valor: true },
            },
            _count: {
              select: {
                inscricoes: {
                  where: {
                    status: {
                      notIn: [
                        StatusInscricao.CANCELADA,
                        StatusInscricao.EXPIRADA,
                      ],
                    },
                  },
                },
              },
            },
          },
        },
        modelosCamisa: {
          where: { ativo: true },
          select: {
            id: true,
            nome: true,
            descricao: true,
            fotoFrenteUrl: true,
            fotoVersoUrl: true,
            ordem: true,
          },
          orderBy: [{ ordem: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!evento) {
      throw new NotFoundException('Evento não encontrado.');
    }

    // Garante que todas as modalidades ativas do evento tenham ao menos 1 categoria (Geral)
    for (const mod of evento.modalidades) {
      if (mod.ativo && mod.categorias.length === 0) {
        const catPadrao = await this.prisma.categoria.create({
          data: {
            modalidadeId: mod.id,
            nome: 'Geral',
            genero: 'LIVRE',
            pcd: false,
          },
          select: {
            id: true,
            nome: true,
            idadeMinima: true,
            idadeMaxima: true,
            genero: true,
            pcd: true,
            servidorPublico: true,
            capacidade: true,
          },
        });
        mod.categorias.push({ ...catPadrao, _count: { inscricoes: 0 } });
      }
    }

    const totalInscritosEvento = evento.modalidades.reduce(
      (acc, mod) =>
        acc + mod.categorias.reduce((acc2, cat) => acc2 + cat._count.inscricoes, 0),
      0,
    );

    const { organizador, ...dadosEvento } = evento;
    const pj = organizador.cliente.pj;
    const pf = organizador.cliente.pf;

    const resposta = {
      ...dadosEvento,
      organizador: {
        nome: pj ? pj.nomeFantasia || pj.razaoSocial : pf?.nomeCompleto ?? null,
        whatsapp: (pj ? pj.celularComercial : pf?.celular) || null,
      },
      ...(evento.status === StatusEvento.PUBLICADO
        ? calcularSituacaoVendas(evento.lotes)
        : { situacaoVendas: null, vendasAbremEm: null }),
      // Hora do servidor: a contagem regressiva nao depende do relogio do
      // celular de quem esta vendo.
      agoraServidor: new Date(),
      vagasRestantes:
        evento.capacidade === null
          ? null
          : evento.capacidade - totalInscritosEvento,
      modalidades: evento.modalidades.map((mod) => {
        const inscritosModalidade = mod.categorias.reduce(
          (acc, cat) => acc + cat._count.inscricoes,
          0,
        );
        return {
          ...mod,
          vagasRestantes:
            mod.capacidade === null
              ? null
              : mod.capacidade - inscritosModalidade,
          categorias: mod.categorias.map(({ _count, ...categoria }) => ({
            ...categoria,
            vagasRestantes:
              categoria.capacidade === null
                ? null
                : categoria.capacidade - _count.inscricoes,
          })),
        };
      }),
      lotes: evento.lotes.map(({ _count, ...lote }) => ({
        ...lote,
        vagasRestantes:
          lote.quantidade === null
            ? null
            : lote.quantidade - _count.inscricoes,
      })),
    };

    return evento.eventoGratuito
      ? this.comoEventoGratuito(resposta)
      : resposta;
  }

  /**
   * Evento 100% gratuito: o site recebe tudo a R$ 0 e sem os descontos (que
   * nao fazem sentido sem preco), e assim mostra "Gratuito" e conclui a
   * inscricao sem pagamento pelo caminho que ja existe. O servidor aplica a
   * mesma regra na hora de inscrever; isto e so o que o site enxerga.
   */
  private async comoEventoGratuito<
    T extends {
      id: string;
      status: StatusEvento;
      vagasEventoGratuito: number | null;
      vagasRestantes: number | null;
      modalidades: Array<{ vagasRestantes: number | null }>;
      lotes: Array<{ precos: Array<{ valor: unknown }> }>;
    },
  >(resposta: T) {
    let vagasGratuitasRestantes: number | null = null;
    if (resposta.vagasEventoGratuito !== null) {
      const usadas = await this.prisma.inscricao.count({
        where: filtroVagaGratuitaEmUso(resposta.id),
      });
      vagasGratuitasRestantes = Math.max(0, resposta.vagasEventoGratuito - usadas);
    }

    // Vagas acabando antes da capacidade: o site usa os mesmos campos de
    // "vagas restantes" para avisar esgotado.
    const limitar = (v: number | null) =>
      vagasGratuitasRestantes === null
        ? v
        : v === null
          ? vagasGratuitasRestantes
          : Math.min(v, vagasGratuitasRestantes);

    // Acabaram as vagas gratuitas: a pagina mostra "Inscrições Esgotadas",
    // como na vitrine (ver eventosGratuitosLotados).
    const lotado =
      vagasGratuitasRestantes === 0 && resposta.status === StatusEvento.PUBLICADO;

    return {
      ...resposta,
      ...(lotado
        ? {
            status: StatusEvento.INSCRICOES_ENCERRADAS,
            situacaoVendas: null,
            vendasAbremEm: null,
          }
        : {}),
      valorCamisaOpcional: null,
      aplicaDescontoIdoso: false,
      aplicaDescontoPcd: false,
      permiteServidorPublico: false,
      permiteFuncionarios: false,
      vagasGratuitasRestantes,
      vagasRestantes: limitar(resposta.vagasRestantes),
      modalidades: resposta.modalidades.map((mod) => ({
        ...mod,
        vagasRestantes: limitar(mod.vagasRestantes),
      })),
      lotes: resposta.lotes.map((lote) => ({
        ...lote,
        precos: lote.precos.map((preco) => ({ ...preco, valor: 0 })),
      })),
    };
  }
}
