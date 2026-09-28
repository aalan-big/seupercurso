import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AssinaturaAtivaGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.userId) {
      throw new ForbiddenException('Acesso negado. Login necessário.');
    }

    const vinculo = await this.prisma.usuarioCronometragem.findUnique({
      where: { usuarioId: user.userId },
      include: {
        cronometradora: true,
      },
    });

    if (!vinculo || !vinculo.ativo) {
      throw new ForbiddenException(
        'Esta conta não possui acesso ao sistema de cronometragem.',
      );
    }

    const crono = vinculo.cronometradora;
    if (crono.status !== 'ATIVA') {
      throw new ForbiddenException(
        `A empresa de cronometragem ${crono.nome} está ${crono.status.toLowerCase()}.`,
      );
    }

    const agora = new Date();
    if (new Date(crono.assinaturaValidaAte) < agora) {
      const dataFormatada = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
      }).format(new Date(crono.assinaturaValidaAte));

      throw new ForbiddenException(
        `A assinatura anual da ${crono.nome} venceu em ${dataFormatada}. Renove em seupercurso.esp.br.`,
      );
    }

    // Anexa os dados da cronometradora para uso no controller
    request.cronometradora = crono;
    request.usuarioCronometragem = vinculo;

    return true;
  }
}
