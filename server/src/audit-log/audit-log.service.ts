import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CategoriaAuditLog, NivelAuditLog } from '../generated/prisma/enums';

export interface RegistrarLogInput {
  categoria: CategoriaAuditLog;
  nivel?: NivelAuditLog;
  mensagem: string;
  detalhes?: any;
  usuarioId?: string;
  ip?: string;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Grava um log de auditoria no banco de dados de forma assíncrona sem travar a execução principal
   */
  log(input: RegistrarLogInput) {
    const { categoria, nivel = NivelAuditLog.INFO, mensagem, detalhes, usuarioId, ip } = input;

    // Log no console com cor adequada
    if (nivel === NivelAuditLog.ERROR) {
      this.logger.error(`[${categoria}] ${mensagem}`, detalhes ? JSON.stringify(detalhes) : '');
    } else if (nivel === NivelAuditLog.WARN) {
      this.logger.warn(`[${categoria}] ${mensagem}`);
    } else {
      this.logger.log(`[${categoria}] ${mensagem}`);
    }

    // Gravação no PostgreSQL sem await (fire and forget)
    this.prisma.auditLog
      .create({
        data: {
          categoria,
          nivel,
          mensagem,
          detalhes: detalhes ? detalhes : undefined,
          usuarioId,
          ip,
        },
      })
      .catch((err) => {
        this.logger.error(`Falha ao gravar log no banco: ${err.message}`);
      });
  }

  /**
   * Busca lista paginada de logs para o painel Admin Master
   */
  async listarLogs(query: {
    categoria?: CategoriaAuditLog;
    nivel?: NivelAuditLog;
    busca?: string;
    pagina?: number;
    limite?: number;
  }) {
    const pagina = Number(query.pagina || 1);
    const limite = Number(query.limite || 30);
    const skip = (pagina - 1) * limite;

    const where: any = {};

    if (query.categoria) {
      where.categoria = query.categoria;
    }

    if (query.nivel) {
      where.nivel = query.nivel;
    }

    if (query.busca) {
      where.OR = [
        { mensagem: { contains: query.busca, mode: 'insensitive' } },
      ];
    }

    const [itens, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limite,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      itens,
      total,
      pagina,
      totalPaginas: Math.ceil(total / limite),
    };
  }
}
