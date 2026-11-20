import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import type { Prisma } from '../generated/prisma/client';
import {
  GeneroCategoria,
  StatusInscricao,
  StatusRegistro,
  StatusUsuario,
} from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { cpfEhValido } from '../common/validators/is-cpf.validator';
import { calcularIdade } from '../common/calcular-idade';
import {
  chaveTexto,
  lerPlanilhaAtletas,
  LinhaPlanilhaAtleta,
  normalizarCpf,
  normalizarGenero,
} from './importacao-atletas-parser';

/**
 * Conta interna que guarda as inscricoes importadas ate o atleta entrar no
 * site com o mesmo CPF (ai a inscricao passa para a conta dele). Ninguem entra
 * nela: senha aleatoria que ninguem conhece, usuario e cliente INATIVOS.
 */
export const EMAIL_CONTA_IMPORTACAO = 'importacao@sistema.seupercurso.interno';

/** Destino de um grupo da planilha: uma categoria, ou "auto:<modalidadeId>". */
type Destino = string;
const PREFIXO_AUTO = 'auto:';

const STATUS_ATIVOS = [
  StatusInscricao.CONFIRMADA,
  StatusInscricao.PENDENTE_PAGAMENTO,
];
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const REGEX_NOME = /^[A-Za-zÀ-ÿ'´`^~.-]{2,}(?:\s+[A-Za-zÀ-ÿ'´`^~.-]+)+$/;

type Db = Prisma.TransactionClient | PrismaService;

interface CategoriaDoEvento {
  id: string;
  nome: string;
  modalidadeId: string;
  modalidadeNome: string;
  idadeMinima: number | null;
  idadeMaxima: number | null;
  genero: GeneroCategoria;
  pcd: boolean;
  servidorPublico: boolean;
  capacidade: number | null;
}

export interface GrupoPlanilha {
  /** Chave do grupo: modalidade|categoria como vieram (normalizados). */
  chave: string;
  modalidade: string;
  categoria: string;
  quantidade: number;
  /** O que o sistema achou sozinho (nulo = organizador precisa escolher). */
  sugestao: Destino | null;
  /** O que vale: escolha do organizador ou a sugestao. */
  destino: Destino | null;
}

export interface LinhaAnalisada {
  linha: number;
  nome: string;
  cpf: string;
  dataNascimento: string;
  genero: string;
  tamanhoCamisa: string;
  numeroPeito: string;
  email: string;
  modalidadeTexto: string;
  categoriaTexto: string;
  categoriaId: string | null;
  categoriaNome: string | null;
  modalidadeNome: string | null;
  erros: string[];
  avisos: string[];
}

export interface AnaliseImportacao {
  linhas: LinhaAnalisada[];
  grupos: GrupoPlanilha[];
  categorias: CategoriaDoEvento[];
  resumo: { total: number; validas: number; comErro: number; comAviso: number };
}

/**
 * Importacao de atletas vendidos em outro site (planilha). So vale no evento
 * em que o admin ligou `Evento.importacaoLiberada`.
 *
 * Nada aqui passa pelo checkout, Mercado Pago, cupom ou taxa: as inscricoes
 * nascem CONFIRMADAS, sem pedido e sem pagamento, num lote interno que nunca
 * vende. Ocupam vaga do evento, do percurso e da categoria.
 */
@Injectable()
export class ImportacaoAtletasService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(usuarioId: string, eventoId: string) {
    const evento = await this.getEventoDoOrganizadorOuFalhar(
      usuarioId,
      eventoId,
    );

    const importacoes = await this.prisma.importacaoAtletas.findMany({
      where: { eventoId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            inscricoes: { where: { status: StatusInscricao.CONFIRMADA } },
          },
        },
      },
    });

    const kits = await this.prisma.inscricao.groupBy({
      by: ['importacaoId'],
      where: {
        importacaoId: { in: importacoes.map((i) => i.id) },
        status: StatusInscricao.CONFIRMADA,
        kitEntregueEm: { not: null },
      },
      _count: { _all: true },
    });
    const kitsPorImportacao = new Map(
      kits.map((k) => [k.importacaoId, k._count._all]),
    );

    return {
      liberada: evento.importacaoLiberada,
      importacoes: importacoes.map(({ _count, ...imp }) => {
        const kitsEntregues = kitsPorImportacao.get(imp.id) ?? 0;
        return {
          ...imp,
          ativos: _count.inscricoes,
          kitsEntregues,
          podeDesfazer: !imp.desfeitaEm && kitsEntregues === 0,
        };
      }),
    };
  }

  /** Le a planilha e mostra o que vai acontecer com cada linha. Nao grava nada. */
  async previa(
    usuarioId: string,
    eventoId: string,
    arquivo: { buffer: Buffer; mimetype?: string; originalname?: string },
    mapeamento: Record<string, string> = {},
  ): Promise<AnaliseImportacao> {
    const evento = await this.getEventoDoOrganizadorOuFalhar(
      usuarioId,
      eventoId,
    );
    this.garantirLiberada(evento);

    const linhas = await lerPlanilhaAtletas(
      arquivo.buffer,
      arquivo.mimetype,
      arquivo.originalname,
    );
    return this.analisar(this.prisma, evento, linhas, mapeamento);
  }

  /**
   * Grava as linhas sem erro. `esperados` e quantas a revisao mostrou como
   * validas: se mudou (alguem comprou, acabou vaga), nada e gravado e o
   * organizador revisa de novo.
   */
  async confirmar(
    usuarioId: string,
    eventoId: string,
    arquivo: { buffer: Buffer; mimetype?: string; originalname?: string },
    dados: {
      siteOrigem: string;
      autorizacaoAtletas: boolean;
      mapeamento: Record<string, string>;
      esperados: number;
    },
  ) {
    const evento = await this.getEventoDoOrganizadorOuFalhar(
      usuarioId,
      eventoId,
    );
    this.garantirLiberada(evento);

    const siteOrigem = (dados.siteOrigem || '').trim();
    if (!siteOrigem) {
      throw new BadRequestException(
        'Informe em qual site esses atletas compraram.',
      );
    }
    if (!dados.autorizacaoAtletas) {
      throw new BadRequestException(
        'Confirme que os atletas autorizaram o uso dos dados para a inscrição.',
      );
    }

    const linhas = await lerPlanilhaAtletas(
      arquivo.buffer,
      arquivo.mimetype,
      arquivo.originalname,
    );

    return this.prisma.$transaction(
      async (tx) => {
        // Uma importacao por vez no evento: dois cliques no "Confirmar" nao
        // gravam a lista duas vezes (a segunda ja ve os CPFs da primeira).
        const chave = `importacao-atletas:${eventoId}`;
        await tx.$queryRaw`SELECT 1 FROM (SELECT pg_advisory_xact_lock(hashtext(${chave}))) AS trava`;

        const analise = await this.analisar(
          tx,
          evento,
          linhas,
          dados.mapeamento,
        );
        const validas = analise.linhas.filter((l) => l.erros.length === 0);

        if (validas.length === 0) {
          throw new BadRequestException(
            'Nenhum atleta da planilha pode ser importado.',
          );
        }
        if (validas.length !== dados.esperados) {
          throw new ConflictException(
            `A lista mudou desde a revisão (agora ${validas.length} atleta(s) podem entrar, antes eram ${dados.esperados}). Revise de novo antes de confirmar.`,
          );
        }

        const clienteId = await this.obterContaImportacao(tx);
        const loteId = await this.obterLoteImportacao(tx, eventoId);

        const importacao = await tx.importacaoAtletas.create({
          data: {
            eventoId,
            usuarioId,
            siteOrigem: siteOrigem.slice(0, 60),
            nomeArquivo: (arquivo.originalname || 'planilha').slice(0, 200),
            totalAtletas: validas.length,
          },
        });

        await tx.inscricao.createMany({
          data: validas.map((l) => ({
            clienteId,
            loteId,
            categoriaId: l.categoriaId!,
            importacaoId: importacao.id,
            status: StatusInscricao.CONFIRMADA,
            atletaNome: l.nome,
            atletaCpf: l.cpf,
            atletaDataNascimento: new Date(`${l.dataNascimento}T00:00:00.000Z`),
            atletaGenero: l.genero as 'MASCULINO' | 'FEMININO' | 'OUTRO',
            tamanhoCamisa: l.tamanhoCamisa || null,
            numeroPeito: l.numeroPeito || null,
            atletaEmail: l.email || null,
          })),
        });

        return {
          importacaoId: importacao.id,
          importados: validas.length,
          ignorados: analise.linhas.length - validas.length,
        };
      },
      { timeout: 60_000, maxWait: 15_000 },
    );
  }

  /**
   * Desfaz uma importacao: as inscricoes viram CANCELADAS (nada e apagado) e
   * as vagas voltam. Nao deixa se algum kit ja foi entregue.
   */
  async desfazer(usuarioId: string, eventoId: string, importacaoId: string) {
    await this.getEventoDoOrganizadorOuFalhar(usuarioId, eventoId);

    return this.prisma.$transaction(async (tx) => {
      const chave = `importacao-atletas:${eventoId}`;
      await tx.$queryRaw`SELECT 1 FROM (SELECT pg_advisory_xact_lock(hashtext(${chave}))) AS trava`;

      const importacao = await tx.importacaoAtletas.findUnique({
        where: { id: importacaoId },
      });
      if (!importacao || importacao.eventoId !== eventoId) {
        throw new NotFoundException('Importação não encontrada.');
      }
      if (importacao.desfeitaEm) {
        throw new BadRequestException('Esta importação já foi desfeita.');
      }

      const comKit = await tx.inscricao.count({
        where: {
          importacaoId,
          status: StatusInscricao.CONFIRMADA,
          kitEntregueEm: { not: null },
        },
      });
      if (comKit > 0) {
        throw new BadRequestException(
          `Não dá para desfazer: ${comKit} atleta(s) desta importação já retiraram o kit.`,
        );
      }

      const { count } = await tx.inscricao.updateMany({
        where: { importacaoId, status: StatusInscricao.CONFIRMADA },
        data: { status: StatusInscricao.CANCELADA },
      });
      await tx.importacaoAtletas.update({
        where: { id: importacaoId },
        data: { desfeitaEm: new Date() },
      });

      return { canceladas: count };
    });
  }

  // ---------------------------------------------------------------------------

  /** Valida todas as linhas e resolve a categoria de cada uma. */
  async analisar(
    db: Db,
    evento: { id: string; dataInicio: Date; capacidade: number | null },
    brutas: LinhaPlanilhaAtleta[],
    mapeamento: Record<string, string> = {},
  ): Promise<AnaliseImportacao> {
    const modalidades = await db.modalidade.findMany({
      where: { eventoId: evento.id },
      include: { categorias: true },
      orderBy: { createdAt: 'asc' },
    });
    const categorias: CategoriaDoEvento[] = modalidades.flatMap((m) =>
      m.categorias.map((c) => ({
        id: c.id,
        nome: c.nome,
        modalidadeId: m.id,
        modalidadeNome: m.nome,
        idadeMinima: c.idadeMinima,
        idadeMaxima: c.idadeMaxima,
        genero: c.genero,
        pcd: c.pcd,
        servidorPublico: c.servidorPublico,
        capacidade: c.capacidade,
      })),
    );
    const categoriaPorId = new Map(categorias.map((c) => [c.id, c]));
    const modalidadePorId = new Map(modalidades.map((m) => [m.id, m]));

    // Grupos modalidade|categoria da planilha, cada um com um destino.
    const grupos = new Map<string, GrupoPlanilha>();
    for (const b of brutas) {
      const chave = `${chaveTexto(b.modalidade)}|${chaveTexto(b.categoria)}`;
      const grupo = grupos.get(chave);
      if (grupo) {
        grupo.quantidade++;
        continue;
      }
      const sugestao = this.sugerirDestino(
        b.modalidade,
        b.categoria,
        modalidades,
      );
      const escolhido = mapeamento[chave];
      grupos.set(chave, {
        chave,
        modalidade: b.modalidade,
        categoria: b.categoria,
        quantidade: 1,
        sugestao,
        destino: this.destinoValido(escolhido, categoriaPorId, modalidadePorId)
          ? escolhido
          : sugestao,
      });
    }

    const linhas: LinhaAnalisada[] = brutas.map((b) => {
      const cpf = normalizarCpf(b.cpf);
      const genero = normalizarGenero(b.genero);
      const email = (b.email || '').trim().toLowerCase();
      const linha: LinhaAnalisada = {
        linha: b.linha,
        nome: b.nome,
        cpf,
        dataNascimento: b.dataNascimento,
        genero: genero ?? b.genero,
        tamanhoCamisa: (b.tamanhoCamisa || '')
          .trim()
          .toUpperCase()
          .slice(0, 10),
        numeroPeito: (b.numeroPeito || '').trim(),
        email,
        modalidadeTexto: b.modalidade,
        categoriaTexto: b.categoria,
        categoriaId: null,
        categoriaNome: null,
        modalidadeNome: null,
        erros: [],
        avisos: [],
      };

      if (!REGEX_NOME.test(b.nome) || b.nome.length > 150) {
        linha.erros.push('Nome completo inválido (nome e sobrenome).');
      }
      if (!cpfEhValido(cpf)) linha.erros.push('CPF inválido.');

      const nascimento = /^\d{4}-\d{2}-\d{2}$/.test(b.dataNascimento)
        ? new Date(`${b.dataNascimento}T00:00:00.000Z`)
        : null;
      if (
        !nascimento ||
        nascimento.getUTCFullYear() < 1900 ||
        nascimento > new Date()
      ) {
        linha.erros.push('Data de nascimento inválida (use dd/mm/aaaa).');
      }
      if (!genero) linha.erros.push('Sexo inválido (use M ou F).');
      if (email && !REGEX_EMAIL.test(email)) {
        linha.erros.push('E-mail inválido.');
      }
      if (linha.numeroPeito.length > 10) {
        linha.erros.push('Número de peito muito longo.');
      }

      // Categoria pelo destino do grupo.
      const destino = grupos.get(
        `${chaveTexto(b.modalidade)}|${chaveTexto(b.categoria)}`,
      )?.destino;
      let categoria: CategoriaDoEvento | undefined;
      if (destino?.startsWith(PREFIXO_AUTO)) {
        if (nascimento && genero) {
          categoria = this.escolherCategoriaAuto(
            categorias.filter(
              (c) => c.modalidadeId === destino.slice(PREFIXO_AUTO.length),
            ),
            calcularIdade(nascimento, evento.dataInicio),
            genero,
          );
          if (!categoria) {
            linha.erros.push(
              'Não deu para escolher a categoria pela idade e sexo. Escolha a categoria deste grupo.',
            );
          }
        }
      } else if (destino) {
        categoria = categoriaPorId.get(destino);
      }
      if (!destino) {
        linha.erros.push(
          `Escolha a modalidade/categoria do grupo "${b.modalidade || '(vazio)'}${b.categoria ? ` / ${b.categoria}` : ''}".`,
        );
      }
      if (categoria) {
        linha.categoriaId = categoria.id;
        linha.categoriaNome = categoria.nome;
        linha.modalidadeNome = categoria.modalidadeNome;
      }
      return linha;
    });

    this.marcarRepetidosNaPlanilha(linhas);
    await this.marcarJaInscritos(db, evento.id, linhas);
    await this.marcarPeitoEmUso(db, evento.id, linhas);
    await this.marcarSemVaga(db, evento, categorias, linhas);

    const validas = linhas.filter((l) => l.erros.length === 0).length;
    return {
      linhas,
      grupos: [...grupos.values()],
      categorias,
      resumo: {
        total: linhas.length,
        validas,
        comErro: linhas.length - validas,
        comAviso: linhas.filter(
          (l) => l.erros.length === 0 && l.avisos.length > 0,
        ).length,
      },
    };
  }

  private sugerirDestino(
    modalidadeTexto: string,
    categoriaTexto: string,
    modalidades: Array<{
      id: string;
      nome: string;
      categorias: Array<{ id: string; nome: string }>;
    }>,
  ): Destino | null {
    const chaveMod = chaveTexto(modalidadeTexto);
    const chaveCat = chaveTexto(categoriaTexto);

    // Sem modalidade na planilha e evento com uma so: e ela.
    const modalidade = chaveMod
      ? modalidades.find((m) => chaveTexto(m.nome) === chaveMod)
      : modalidades.length === 1
        ? modalidades[0]
        : undefined;
    if (!modalidade) return null;

    if (modalidade.categorias.length === 1) return modalidade.categorias[0].id;
    if (chaveCat) {
      const cat = modalidade.categorias.find(
        (c) => chaveTexto(c.nome) === chaveCat,
      );
      if (cat) return cat.id;
    }
    return `${PREFIXO_AUTO}${modalidade.id}`;
  }

  private destinoValido(
    destino: string | undefined,
    categorias: Map<string, CategoriaDoEvento>,
    modalidades: Map<string, unknown>,
  ): destino is string {
    if (!destino) return false;
    if (destino.startsWith(PREFIXO_AUTO)) {
      return modalidades.has(destino.slice(PREFIXO_AUTO.length));
    }
    return categorias.has(destino);
  }

  /**
   * Categoria da modalidade que serve para a idade e o sexo. Categorias de PCD
   * e de servidor publico ficam de fora (precisam de escolha do organizador).
   * Mais de uma servindo: fica a de faixa de idade mais estreita; empate = nenhuma.
   */
  private escolherCategoriaAuto(
    categorias: CategoriaDoEvento[],
    idade: number,
    genero: 'MASCULINO' | 'FEMININO' | 'OUTRO',
  ): CategoriaDoEvento | undefined {
    const servem = categorias.filter(
      (c) =>
        !c.pcd &&
        !c.servidorPublico &&
        (c.genero === GeneroCategoria.LIVRE || c.genero === genero) &&
        (c.idadeMinima === null || idade >= c.idadeMinima) &&
        (c.idadeMaxima === null || idade <= c.idadeMaxima),
    );
    if (servem.length <= 1) return servem[0];

    const largura = (c: CategoriaDoEvento) =>
      (c.idadeMaxima ?? 200) -
      (c.idadeMinima ?? 0) +
      (c.genero === GeneroCategoria.LIVRE ? 0.5 : 0);
    const ordenadas = [...servem].sort((a, b) => largura(a) - largura(b));
    return largura(ordenadas[0]) < largura(ordenadas[1])
      ? ordenadas[0]
      : undefined;
  }

  private marcarRepetidosNaPlanilha(linhas: LinhaAnalisada[]) {
    const primeiraPorCpf = new Map<string, number>();
    const primeiraPorPeito = new Map<string, number>();
    for (const l of linhas) {
      if (l.cpf) {
        const anterior = primeiraPorCpf.get(l.cpf);
        if (anterior !== undefined) {
          l.erros.push(
            `CPF repetido na planilha (já está na linha ${anterior}).`,
          );
        } else {
          primeiraPorCpf.set(l.cpf, l.linha);
        }
      }
      if (l.numeroPeito) {
        const anterior = primeiraPorPeito.get(l.numeroPeito);
        if (anterior !== undefined) {
          l.erros.push(
            `Número de peito repetido na planilha (já está na linha ${anterior}).`,
          );
        } else {
          primeiraPorPeito.set(l.numeroPeito, l.linha);
        }
      }
    }
  }

  /** Mesma regra da compra: atleta*, dependente, ou o titular nas antigas. */
  private async marcarJaInscritos(
    db: Db,
    eventoId: string,
    linhas: LinhaAnalisada[],
  ) {
    const cpfs = [
      ...new Set(linhas.map((l) => l.cpf).filter((c) => c.length === 11)),
    ];
    if (cpfs.length === 0) return;

    const existentes = await db.inscricao.findMany({
      where: {
        status: { in: STATUS_ATIVOS },
        categoria: { modalidade: { eventoId } },
        OR: [
          { atletaCpf: { in: cpfs } },
          { dependente: { cpf: { in: cpfs } } },
          {
            atletaCpf: null,
            dependenteId: null,
            cliente: { pf: { cpf: { in: cpfs } } },
          },
        ],
      },
      select: {
        status: true,
        importacaoId: true,
        atletaCpf: true,
        dependente: { select: { cpf: true } },
        cliente: { select: { pf: { select: { cpf: true } } } },
      },
    });

    const porCpf = new Map<
      string,
      { status: StatusInscricao; importada: boolean }
    >();
    for (const e of existentes) {
      const cpf = e.atletaCpf ?? e.dependente?.cpf ?? e.cliente.pf?.cpf;
      if (!cpf) continue;
      const atual = porCpf.get(cpf);
      // Confirmada pesa mais que pendente.
      if (!atual || e.status === StatusInscricao.CONFIRMADA) {
        porCpf.set(cpf, { status: e.status, importada: !!e.importacaoId });
      }
    }

    for (const l of linhas) {
      const achado = porCpf.get(l.cpf);
      if (!achado) continue;
      if (achado.status === StatusInscricao.CONFIRMADA) {
        l.erros.push(
          achado.importada
            ? 'Atleta já importado antes neste evento.'
            : 'Atleta já inscrito neste evento (comprou no Seu Percurso).',
        );
      } else {
        l.avisos.push(
          'Tem um pedido aguardando pagamento neste site. Se ele pagar, ficará inscrito duas vezes.',
        );
      }
    }
  }

  private async marcarPeitoEmUso(
    db: Db,
    eventoId: string,
    linhas: LinhaAnalisada[],
  ) {
    const numeros = [
      ...new Set(linhas.map((l) => l.numeroPeito).filter(Boolean)),
    ];
    if (numeros.length === 0) return;

    const emUso = await db.inscricao.findMany({
      where: {
        categoria: { modalidade: { eventoId } },
        status: { in: STATUS_ATIVOS },
        numeroPeito: { in: numeros },
      },
      select: { numeroPeito: true },
    });
    const usados = new Set(emUso.map((i) => i.numeroPeito));
    for (const l of linhas) {
      if (l.numeroPeito && usados.has(l.numeroPeito)) {
        l.erros.push(
          `Número de peito ${l.numeroPeito} já é de outro atleta do evento.`,
        );
      }
    }
  }

  /**
   * Vagas do evento, do percurso e da categoria, na ordem da planilha: as
   * primeiras entram, as que passariam do limite ficam marcadas.
   */
  private async marcarSemVaga(
    db: Db,
    evento: { id: string; capacidade: number | null },
    categorias: CategoriaDoEvento[],
    linhas: LinhaAnalisada[],
  ) {
    const ocupadas = await db.inscricao.groupBy({
      by: ['categoriaId'],
      where: {
        categoria: { modalidade: { eventoId: evento.id } },
        status: {
          notIn: [StatusInscricao.CANCELADA, StatusInscricao.EXPIRADA],
        },
      },
      _count: { _all: true },
    });
    const capacidadesModalidade = await db.modalidade.findMany({
      where: { eventoId: evento.id },
      select: { id: true, nome: true, capacidade: true },
    });

    const categoriaPorId = new Map(categorias.map((c) => [c.id, c]));
    const porCategoria = new Map<string, number>();
    const porModalidade = new Map<string, number>();
    let noEvento = 0;
    for (const o of ocupadas) {
      const cat = categoriaPorId.get(o.categoriaId);
      porCategoria.set(o.categoriaId, o._count._all);
      if (cat) {
        porModalidade.set(
          cat.modalidadeId,
          (porModalidade.get(cat.modalidadeId) ?? 0) + o._count._all,
        );
      }
      noEvento += o._count._all;
    }
    const modalidadePorId = new Map(
      capacidadesModalidade.map((m) => [m.id, m]),
    );

    for (const l of linhas) {
      if (l.erros.length > 0 || !l.categoriaId) continue;
      const cat = categoriaPorId.get(l.categoriaId)!;
      const mod = modalidadePorId.get(cat.modalidadeId);
      const usadasCat = porCategoria.get(cat.id) ?? 0;
      const usadasMod = porModalidade.get(cat.modalidadeId) ?? 0;

      if (evento.capacidade !== null && noEvento >= evento.capacidade) {
        l.erros.push(`Sem vaga no evento (limite de ${evento.capacidade}).`);
      } else if (mod?.capacidade != null && usadasMod >= mod.capacidade) {
        l.erros.push(
          `Sem vaga no percurso ${mod.nome} (limite de ${mod.capacidade}).`,
        );
      } else if (cat.capacidade !== null && usadasCat >= cat.capacidade) {
        l.erros.push(
          `Sem vaga na categoria ${cat.nome} (limite de ${cat.capacidade}).`,
        );
      } else {
        noEvento++;
        porModalidade.set(cat.modalidadeId, usadasMod + 1);
        porCategoria.set(cat.id, usadasCat + 1);
      }
    }
  }

  private async obterContaImportacao(
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const existente = await tx.usuario.findUnique({
      where: { email: EMAIL_CONTA_IMPORTACAO },
      select: { cliente: { select: { id: true } } },
    });
    if (existente?.cliente) return existente.cliente.id;

    const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 12);
    const usuario = await tx.usuario.upsert({
      where: { email: EMAIL_CONTA_IMPORTACAO },
      update: {},
      create: {
        email: EMAIL_CONTA_IMPORTACAO,
        passwordHash,
        status: StatusUsuario.INATIVO,
        cliente: { create: { status: StatusRegistro.INATIVO } },
      },
      select: { cliente: { select: { id: true } } },
    });
    if (!usuario.cliente) {
      throw new Error('Conta interna de importação sem cliente.');
    }
    return usuario.cliente.id;
  }

  private async obterLoteImportacao(
    tx: Prisma.TransactionClient,
    eventoId: string,
  ) {
    const existente = await tx.lote.findFirst({
      where: { eventoId, somenteImportacao: true },
      select: { id: true },
    });
    if (existente) return existente.id;

    const agora = new Date();
    const lote = await tx.lote.create({
      data: {
        eventoId,
        nome: 'Importados de outro site',
        inicioVenda: agora,
        fimVenda: agora,
        somenteImportacao: true,
      },
      select: { id: true },
    });
    return lote.id;
  }

  private garantirLiberada(evento: { importacaoLiberada: boolean }) {
    if (!evento.importacaoLiberada) {
      throw new ForbiddenException(
        'A importação de atletas não está liberada para este evento. Fale com o suporte do Seu Percurso.',
      );
    }
  }

  private async getEventoDoOrganizadorOuFalhar(
    usuarioId: string,
    eventoId: string,
  ) {
    if (!/^[0-9a-f-]{36}$/i.test(eventoId)) {
      throw new NotFoundException('Evento não encontrado.');
    }
    const cliente = await this.prisma.cliente.findUnique({
      where: { usuarioId },
      include: { organizador: true },
    });
    if (!cliente?.organizador) {
      throw new ForbiddenException(
        'Apenas organizadores podem importar atletas.',
      );
    }
    const evento = await this.prisma.evento.findUnique({
      where: { id: eventoId },
    });
    if (!evento || evento.organizadorId !== cliente.organizador.id) {
      throw new NotFoundException(
        'Evento não encontrado ou não pertence a você.',
      );
    }
    return evento;
  }
}
