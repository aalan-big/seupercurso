import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ServidorPublicoParserService } from './servidor-publico-parser.service';

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

    // Inserir em lotes de 250 para suportar arquivos grandes (72+ páginas) com alta performance
    const CHUNK_SIZE = 250;
    const servidores = resultado.servidores;
    let inseridosOuAtualizados = 0;

    for (let i = 0; i < servidores.length; i += CHUNK_SIZE) {
      const chunk = servidores.slice(i, i + CHUNK_SIZE);
      const dataParaInserir = chunk.map((s) => ({
        eventoId,
        categoriaId: categoriaVinculadaId,
        cpf: s.cpf,
        matricula: s.matricula,
        nome: s.nome || null,
        orgao: s.orgao || null,
      }));

      const res = await this.prisma.servidorPublico.createMany({
        data: dataParaInserir,
        skipDuplicates: true,
      });
      inseridosOuAtualizados += res.count;
    }

    return {
      sucesso: true,
      totalLidos: resultado.totalEncontrados,
      novosInseridos: inseridosOuAtualizados,
      amostra: servidores.slice(0, 10),
      vagasLimiteEvento: evento.vagasServidorPublico,
      mensagem: `${resultado.totalEncontrados} servidores lidos do arquivo (${inseridosOuAtualizados} novos cadastrados com sucesso).`,
    };
  }

  async listar(usuarioId: string, eventoId: string) {
    const { evento } = await this.getEventoDoOrganizadorOuFalhar(usuarioId, eventoId);

    const [total, utilizados, lista] = await Promise.all([
      this.prisma.servidorPublico.count({ where: { eventoId } }),
      this.prisma.servidorPublico.count({
        where: { eventoId, inscricaoId: { not: null } },
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
