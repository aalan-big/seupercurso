import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { Request } from 'express';
import { AuditLogService } from './audit-log.service';
import { CategoriaAuditLog, NivelAuditLog } from '../generated/prisma/enums';

const JANELA_REPETICAO_MS = 60_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Leva todo erro inesperado (5xx) para a tela de Logs do admin. Antes eles so
 * existiam no terminal da VPS (pm2 logs), e a tela mostrava apenas os eventos
 * que o codigo registra de proposito.
 *
 * A resposta ao cliente nao muda: depois de anotar, delega ao filtro padrao do
 * Nest, o mesmo que respondia antes deste existir. Erros 4xx (validacao, "nao
 * encontrado", sem permissao) ficam de fora: sao respostas esperadas.
 */
@Catch()
export class RegistrarErrosFilter extends BaseExceptionFilter {
  // Mesmo erro na mesma rota entra uma vez por minuto: um defeito repetido
  // nao enche a tabela nem esconde os outros.
  private readonly ultimosRegistros = new Map<string, number>();

  constructor(private readonly auditLogService: AuditLogService) {
    super();
  }

  catch(exception: unknown, host: ArgumentsHost) {
    try {
      this.registrar(exception, host);
    } catch {
      // Registrar nunca pode impedir a resposta de erro de sair.
    }
    super.catch(exception, host);
  }

  private registrar(exception: unknown, host: ArgumentsHost) {
    if (host.getType() !== 'http') return;

    const status =
      exception instanceof HttpException ? exception.getStatus() : 500;
    if (status < 500) return;

    const req = host.switchToHttp().getRequest<Request>();
    // Sem query string: ela pode levar token de redefinicao de senha.
    const caminho = (req.originalUrl || req.url || '').split('?')[0];
    const rota = `${req.method} ${caminho}`;
    const mensagem =
      exception instanceof Error ? exception.message : String(exception);

    const chave = `${rota}|${mensagem}`;
    const agora = Date.now();
    if ((this.ultimosRegistros.get(chave) ?? 0) > agora - JANELA_REPETICAO_MS) {
      return;
    }
    if (this.ultimosRegistros.size > 500) this.ultimosRegistros.clear();
    this.ultimosRegistros.set(chave, agora);

    const usuarioId = (req as any).user?.userId;
    const pilha =
      exception instanceof Error && exception.stack
        ? exception.stack.split('\n').slice(0, 8).join('\n')
        : undefined;

    this.auditLogService.log({
      categoria: CategoriaAuditLog.OPERACIONAL,
      nivel: NivelAuditLog.ERROR,
      mensagem: `Erro ${status} em ${rota}: ${mensagem}`.slice(0, 500),
      detalhes: { status, rota, pilha },
      usuarioId: typeof usuarioId === 'string' && UUID.test(usuarioId) ? usuarioId : undefined,
      ip: req.ip,
    });
  }
}
