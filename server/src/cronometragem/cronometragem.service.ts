import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StatusResultado } from '../generated/prisma/enums';
import { WebhookResultadoDto } from './dto/webhook-resultado.dto';
import { ImportarCsvResultadoDto } from './dto/importar-csv-resultado.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class CronometragemService {
  constructor(private readonly prisma: PrismaService) {}

  async gerarOuRenovarApiKey(usuarioId: string, eventoId: string) {
    const evento = await this.getEventoDoOrganizadorOuFalhar(usuarioId, eventoId);

    const novaApiKey = `crono_live_${randomBytes(16).toString('hex')}`;

    return this.prisma.evento.update({
      where: { id: evento.id },
      data: { apiKeyCronometragem: novaApiKey },
      select: { id: true, nome: true, apiKeyCronometragem: true },
    });
  }

  async buscarInfoCronometragem(usuarioId: string, eventoId: string) {
    const evento = await this.getEventoDoOrganizadorOuFalhar(usuarioId, eventoId);
    return {
      id: evento.id,
      nome: evento.nome,
      apiKeyCronometragem: evento.apiKeyCronometragem,
    };
  }

  async processarResultadoWebhook(apiKey: string, dto: WebhookResultadoDto) {
    if (!apiKey) {
      throw new UnauthorizedException('Chave de API de cronometragem não fornecida.');
    }

    const evento = await this.prisma.evento.findUnique({
      where: { apiKeyCronometragem: apiKey },
    });

    if (!evento) {
      throw new UnauthorizedException('Chave de API de cronometragem inválida.');
    }

    const inscricao = await this.prisma.inscricao.findFirst({
      where: {
        numeroPeito: dto.numeroPeito.toString().trim(),
        categoria: { modalidade: { eventoId: evento.id } },
      },
    });

    if (!inscricao) {
      throw new NotFoundException(
        `Atleta com o número de peito #${dto.numeroPeito} não foi encontrado neste evento.`,
      );
    }

    const statusEnum = this.mapearStatusResultado(dto.status);

    const resultado = await this.prisma.resultado.upsert({
      where: { inscricaoId: inscricao.id },
      create: {
        inscricaoId: inscricao.id,
        tempoLiquidoSegundos: dto.tempoLiquidoSegundos,
        tempoBrutoSegundos: dto.tempoBrutoSegundos || dto.tempoLiquidoSegundos,
        status: statusEnum,
      },
      update: {
        tempoLiquidoSegundos: dto.tempoLiquidoSegundos,
        tempoBrutoSegundos: dto.tempoBrutoSegundos || dto.tempoLiquidoSegundos,
        status: statusEnum,
      },
    });

    // Recalcula as colocações para a modalidade do atleta
    await this.recalcularColocacoesEvento(evento.id);

    return resultado;
  }

  async importarResultadosLote(
    usuarioId: string,
    eventoId: string,
    dto: ImportarCsvResultadoDto,
  ) {
    const evento = await this.getEventoDoOrganizadorOuFalhar(usuarioId, eventoId);

    let processados = 0;
    for (const item of dto.resultados) {
      if (!item.numeroPeito) continue;
      const inscricao = await this.prisma.inscricao.findFirst({
        where: {
          numeroPeito: item.numeroPeito.toString().trim(),
          categoria: { modalidade: { eventoId: evento.id } },
        },
      });

      if (inscricao) {
        const statusEnum = this.mapearStatusResultado(item.status);
        await this.prisma.resultado.upsert({
          where: { inscricaoId: inscricao.id },
          create: {
            inscricaoId: inscricao.id,
            tempoLiquidoSegundos: item.tempoLiquidoSegundos,
            tempoBrutoSegundos: item.tempoBrutoSegundos || item.tempoLiquidoSegundos,
            status: statusEnum,
          },
          update: {
            tempoLiquidoSegundos: item.tempoLiquidoSegundos,
            tempoBrutoSegundos: item.tempoBrutoSegundos || item.tempoLiquidoSegundos,
            status: statusEnum,
          },
        });
        processados++;
      }
    }

    await this.recalcularColocacoesEvento(evento.id);

    return { totalRecebidos: dto.resultados.length, processadosComSucesso: processados };
  }

  async listarResultadosEvento(usuarioId: string, eventoId: string) {
    const evento = await this.getEventoDoOrganizadorOuFalhar(usuarioId, eventoId);

    return this.prisma.inscricao.findMany({
      where: {
        categoria: { modalidade: { eventoId: evento.id } },
        resultado: { isNot: null },
      },
      include: {
        cliente: { include: { pf: true } },
        categoria: { include: { modalidade: true } },
        resultado: true,
      },
      orderBy: {
        resultado: { tempoLiquidoSegundos: 'asc' },
      },
    });
  }

  // Recalcula posições na Geral, por Categoria e por Gênero
  private async recalcularColocacoesEvento(eventoId: string) {
    const modalidades = await this.prisma.modalidade.findMany({
      where: { eventoId },
      include: {
        categorias: {
          include: {
            inscricoes: {
              where: { resultado: { isNot: null } },
              include: { resultado: true, cliente: { include: { pf: true } } },
            },
          },
        },
      },
    });

    for (const mod of modalidades) {
      // Coleta todas as inscrições com resultado da modalidade
      const inscricoesModalidade = mod.categorias
        .flatMap((c) => c.inscricoes)
        .filter((i) => i.resultado && i.resultado.status === StatusResultado.FINALIZADO)
        .sort(
          (a, b) =>
            (a.resultado?.tempoLiquidoSegundos || 999999) -
            (b.resultado?.tempoLiquidoSegundos || 999999),
        );

      // Colocação Geral na Modalidade
      for (let index = 0; index < inscricoesModalidade.length; index++) {
        const insc = inscricoesModalidade[index];
        await this.prisma.resultado.update({
          where: { inscricaoId: insc.id },
          data: { colocacaoGeral: index + 1 },
        });
      }

      // Colocação por Categoria
      for (const cat of mod.categorias) {
        const inscricoesCategoria = cat.inscricoes
          .filter((i) => i.resultado && i.resultado.status === StatusResultado.FINALIZADO)
          .sort(
            (a, b) =>
              (a.resultado?.tempoLiquidoSegundos || 999999) -
              (b.resultado?.tempoLiquidoSegundos || 999999),
          );

        for (let index = 0; index < inscricoesCategoria.length; index++) {
          const insc = inscricoesCategoria[index];
          await this.prisma.resultado.update({
            where: { inscricaoId: insc.id },
            data: { colocacaoCategoria: index + 1 },
          });
        }
      }
    }
  }

  private mapearStatusResultado(status?: string): StatusResultado {
    if (!status) return StatusResultado.FINALIZADO;
    const s = status.toUpperCase().trim();
    if (s === 'DNF') return StatusResultado.DNF;
    if (s === 'DNS') return StatusResultado.DNS;
    if (s === 'DESCLASSIFICADO') return StatusResultado.DESCLASSIFICADO;
    return StatusResultado.FINALIZADO;
  }

  private async getEventoDoOrganizadorOuFalhar(usuarioId: string, eventoId: string) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { usuarioId },
      include: { organizador: true },
    });

    if (!cliente || !cliente.organizador) {
      throw new UnauthorizedException('Acesso negado: Perfil de organizador não encontrado.');
    }

    const evento = await this.prisma.evento.findFirst({
      where: { id: eventoId, organizadorId: cliente.organizador.id },
    });

    if (!evento) {
      throw new NotFoundException('Evento não encontrado para este organizador.');
    }

    return evento;
  }
}
