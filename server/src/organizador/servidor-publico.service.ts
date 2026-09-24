import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ServidorPublicoParserService } from './servidor-publico-parser.service';
import {
  FILTRO_SERVIDOR_EM_USO,
  FILTRO_SERVIDOR_LIVRE,
} from '../common/servidor-publico-em-uso';

@Injectable()
export class ServidorPublicoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parser: ServidorPublicoParserService,
  ) {}

  private async getEventoDoOrganizadorOuFalhar(
    usuarioId: string,
    eventoId: string,
  ) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { usuarioId },
      include: { organizador: true },
    });
    if (!cliente?.organizador) {
      throw new ForbiddenException('Apenas organizadores podem gerenciar eventos.');
    }

    const evento = await this.prisma.evento.findUnique({
      where: { id: eventoId },
    });
    if (!evento || evento.organizadorId !== cliente.organizador.id) {
      throw new NotFoundException('Evento não encontrado ou não pertence a você.');
    }

    return { evento, organizador: cliente.organizador };
  }

  async importarLista(
    usuarioId: string,
    eventoId: string,
    categoriaId: string | undefined,
    buffer: Buffer,
    mimetype?: string,
    originalname?: string,
  ) {
    const { evento } = await this.getEventoDoOrganizadorOuFalhar(usuarioId, eventoId);

    if (!evento.permiteServidorPublico) {
      throw new ForbiddenException(
        'O recurso de Servidor Público com isenção não está liberado para este evento. Entre em contato com a administração da plataforma para liberação.',
      );
    }

    let categoriaVinculadaId: string | null = null;
    if (categoriaId) {
      const categoria = await this.prisma.categoria.findFirst({
        where: { id: categoriaId, modalidade: { eventoId } },
      });
      if (categoria) {
        categoriaVinculadaId = categoria.id;
      }
    }

    const resultado = await this.parser.parseArquivo(buffer, mimetype, originalname);

    if (resultado.totalEncontrados === 0) {
      throw new BadRequestException(
        'Nenhum servidor com CPF e Matrícula válidos foi identificado no arquivo enviado. Verifique se o arquivo possui texto selecionável ou envie em formato Excel/CSV.',
      );
    }

    // Em lotes de 250 para suportar arquivos grandes (72+ páginas).
    const CHUNK_SIZE = 250;
    const servidores = resultado.servidores;
    let novosInseridos = 0;
    let atualizados = 0;
    let ignoradosEmUso = 0;

    for (let i = 0; i < servidores.length; i += CHUNK_SIZE) {
      const chunk = servidores.slice(i, i + CHUNK_SIZE);

      const existentes = await this.prisma.servidorPublico.findMany({
        where: { eventoId, cpf: { in: chunk.map((s) => s.cpf) } },
        select: {
          id: true,
          cpf: true,
          matricula: true,
          nome: true,
          orgao: true,
        },
      });
      const existentesPorCpf = new Map(existentes.map((e) => [e.cpf, e]));

      const novos = chunk.filter((s) => !existentesPorCpf.has(s.cpf));
      if (novos.length > 0) {
        const res = await this.prisma.servidorPublico.createMany({
          data: novos.map((s) => ({
            eventoId,
            categoriaId: categoriaVinculadaId,
            cpf: s.cpf,
            matricula: s.matricula,
            nome: s.nome || null,
            orgao: s.orgao || null,
          })),
          skipDuplicates: true,
        });
        novosInseridos += res.count;
      }

      // Reenviar a lista corrige quem ainda nao usou a isencao (matricula lida
      // errada na primeira vez, por exemplo). Quem ja esta inscrito fica como
      // esta: a matricula dele e a que valeu na inscricao.
      for (const s of chunk) {
        const atual = existentesPorCpf.get(s.cpf);
        if (!atual) continue;

        const mudou =
          atual.matricula !== s.matricula ||
          (s.nome && atual.nome !== s.nome) ||
          (s.orgao && atual.orgao !== s.orgao);
        if (!mudou) continue;

        const { count } = await this.prisma.servidorPublico.updateMany({
          where: { id: atual.id, ...FILTRO_SERVIDOR_LIVRE },
          data: {
            matricula: s.matricula,
            ...(s.nome ? { nome: s.nome } : {}),
            ...(s.orgao ? { orgao: s.orgao } : {}),
          },
        });
        if (count > 0) atualizados++;
        else ignoradosEmUso++;
      }
    }

    const detalhes = [`${novosInseridos} novos cadastrados`];
    if (atualizados > 0) detalhes.push(`${atualizados} corrigidos`);
    if (ignoradosEmUso > 0) {
      detalhes.push(`${ignoradosEmUso} não alterados por já estarem inscritos`);
    }

    return {
      sucesso: true,
      totalLidos: resultado.totalEncontrados,
      novosInseridos,
      atualizados,
      ignoradosEmUso,
      amostra: servidores.slice(0, 10),
      vagasLimiteEvento: evento.vagasServidorPublico,
      mensagem: `${resultado.totalEncontrados} servidores lidos do arquivo (${detalhes.join(', ')}).`,
    };
  }

  async listar(usuarioId: string, eventoId: string) {
    const { evento } = await this.getEventoDoOrganizadorOuFalhar(usuarioId, eventoId);

    const [total, utilizados, lista] = await Promise.all([
      this.prisma.servidorPublico.count({ where: { eventoId } }),
      this.prisma.servidorPublico.count({
        where: { eventoId, ...FILTRO_SERVIDOR_EM_USO },
      }),
      this.prisma.servidorPublico.findMany({
        where: { eventoId },
        select: {
          id: true,
          cpf: true,
          matricula: true,
          nome: true,
          orgao: true,
          utilizadoEm: true,
          inscricaoId: true,
          createdAt: true,
          categoria: { select: { id: true, nome: true } },
        },
        orderBy: [{ utilizadoEm: 'desc' }, { createdAt: 'desc' }],
        take: 200, // Retorna os 200 primeiros para visualização no painel
      }),
    ]);

    return {
      permiteServidorPublico: evento.permiteServidorPublico,
      vagasServidorPublico: evento.vagasServidorPublico,
      totalCadastrados: total,
      totalUtilizados: utilizados,
      vagasRestantesVagasEvento: evento.vagasServidorPublico
        ? Math.max(0, evento.vagasServidorPublico - utilizados)
        : null,
      servidores: lista,
    };
  }

  async removerNaoUtilizados(usuarioId: string, eventoId: string) {
    await this.getEventoDoOrganizadorOuFalhar(usuarioId, eventoId);

    const res = await this.prisma.servidorPublico.deleteMany({
      where: {
        eventoId,
        inscricaoId: null,
      },
    });

    return {
      sucesso: true,
      removidos: res.count,
      mensagem: `${res.count} registros não utilizados foram removidos.`,
    };
  }
}
