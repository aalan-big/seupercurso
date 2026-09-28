import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FuncionarioEmpresaParserService } from './funcionario-empresa-parser.service';
import {
  FILTRO_FUNCIONARIO_EM_USO,
  FILTRO_FUNCIONARIO_LIVRE,
  funcionarioEstaEmUso,
} from '../common/funcionario-empresa-em-uso';

/**
 * Lista de funcionarios da empresa organizadora com direito ao desconto do
 * evento. Recurso separado do servidor publico, com leitor proprio: a chave e
 * a matricula (ou contrato/cracha) e o CPF e opcional.
 */
@Injectable()
export class FuncionarioEmpresaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parser: FuncionarioEmpresaParserService,
  ) {}

  private async getEventoDoOrganizadorOuFalhar(usuarioId: string, eventoId: string) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { usuarioId },
      include: { organizador: true },
    });
    if (!cliente?.organizador) {
      throw new ForbiddenException('Apenas organizadores podem gerenciar eventos.');
    }

    const evento = await this.prisma.evento.findUnique({ where: { id: eventoId } });
    if (!evento || evento.organizadorId !== cliente.organizador.id) {
      throw new NotFoundException('Evento não encontrado ou não pertence a você.');
    }

    return evento;
  }

  async importarLista(
    usuarioId: string,
    eventoId: string,
    buffer: Buffer,
    mimetype?: string,
    originalname?: string,
  ) {
    const evento = await this.getEventoDoOrganizadorOuFalhar(usuarioId, eventoId);

    if (!evento.permiteFuncionarios) {
      throw new ForbiddenException(
        'O desconto para funcionários não está liberado para este evento. Fale com a equipe do Seu Percurso para liberar.',
      );
    }

    const resultado = await this.parser.parseArquivo(buffer, mimetype, originalname);

    if (resultado.totalEncontrados === 0) {
      throw new BadRequestException(
        'Nenhum funcionário foi identificado no arquivo. Cada linha precisa da matrícula (ou contrato/crachá) e do nome completo; o CPF é opcional. Se for PDF, ele precisa ter texto selecionável; senão envie em Excel ou CSV.',
      );
    }

    const CHUNK_SIZE = 250;
    const funcionarios = resultado.funcionarios;
    let novosInseridos = 0;
    let atualizados = 0;
    let ignoradosEmUso = 0;
    let conflitos = 0;

    for (let i = 0; i < funcionarios.length; i += CHUNK_SIZE) {
      const chunk = funcionarios.slice(i, i + CHUNK_SIZE);
      const cpfsDoChunk = chunk.map((f) => f.cpf).filter((c): c is string => !!c);

      // A chave e a matricula. O CPF, quando vem, tambem acha o cadastro:
      // listas antigas subidas com CPF continuam sendo corrigidas pelo reenvio.
      const existentes = await this.prisma.funcionarioEmpresa.findMany({
        where: {
          eventoId,
          OR: [
            { matricula: { in: chunk.map((f) => f.matricula) } },
            ...(cpfsDoChunk.length ? [{ cpf: { in: cpfsDoChunk } }] : []),
          ],
        },
        select: { id: true, cpf: true, matricula: true, nome: true },
      });
      const porMatricula = new Map(existentes.map((e) => [e.matricula.toUpperCase(), e]));
      const porCpf = new Map(existentes.filter((e) => e.cpf).map((e) => [e.cpf, e]));
      const acharExistente = (f: (typeof chunk)[number]) =>
        porMatricula.get(f.matricula.toUpperCase()) ?? (f.cpf ? porCpf.get(f.cpf) : undefined);

      const novos = chunk.filter((f) => !acharExistente(f));
      if (novos.length > 0) {
        const res = await this.prisma.funcionarioEmpresa.createMany({
          data: novos.map((f) => ({
            eventoId,
            cpf: f.cpf || null,
            matricula: f.matricula,
            nome: f.nome || null,
          })),
          skipDuplicates: true,
        });
        novosInseridos += res.count;
        conflitos += novos.length - res.count;
      }

      // Reenviar corrige quem ainda nao usou o desconto; quem ja esta inscrito
      // fica com os dados que valeram na inscricao.
      for (const f of chunk) {
        const atual = acharExistente(f);
        if (!atual) continue;

        const mudou =
          atual.matricula !== f.matricula ||
          (f.nome && atual.nome !== f.nome) ||
          (f.cpf && atual.cpf !== f.cpf);
        if (!mudou) continue;

        try {
          const { count } = await this.prisma.funcionarioEmpresa.updateMany({
            where: { id: atual.id, ...FILTRO_FUNCIONARIO_LIVRE },
            data: {
              matricula: f.matricula,
              ...(f.nome ? { nome: f.nome } : {}),
              ...(f.cpf ? { cpf: f.cpf } : {}),
            },
          });
          if (count > 0) atualizados++;
          else ignoradosEmUso++;
        } catch (err: any) {
          // Matricula ou CPF ja usado por outro funcionario do evento.
          if (err?.code !== 'P2002') throw err;
          conflitos++;
        }
      }
    }

    const detalhes = [`${novosInseridos} novos cadastrados`];
    if (atualizados > 0) detalhes.push(`${atualizados} corrigidos`);
    if (ignoradosEmUso > 0) {
      detalhes.push(`${ignoradosEmUso} não alterados por já estarem inscritos`);
    }
    if (conflitos > 0) {
      detalhes.push(`${conflitos} ignorados por matrícula ou CPF já usado por outro funcionário`);
    }
    if (resultado.matriculasRepetidas > 0) {
      detalhes.push(`${resultado.matriculasRepetidas} matrícula(s) repetida(s) no arquivo`);
    }

    return {
      sucesso: true,
      totalLidos: resultado.totalEncontrados,
      novosInseridos,
      atualizados,
      ignoradosEmUso,
      amostra: funcionarios.slice(0, 10),
      mensagem: `${resultado.totalEncontrados} funcionários lidos do arquivo (${detalhes.join(', ')}).`,
    };
  }

  async listar(usuarioId: string, eventoId: string) {
    const evento = await this.getEventoDoOrganizadorOuFalhar(usuarioId, eventoId);

    const [total, utilizados, lista] = await Promise.all([
      this.prisma.funcionarioEmpresa.count({ where: { eventoId } }),
      this.prisma.funcionarioEmpresa.count({
        where: { eventoId, ...FILTRO_FUNCIONARIO_EM_USO },
      }),
      this.prisma.funcionarioEmpresa.findMany({
        where: { eventoId },
        select: {
          id: true,
          cpf: true,
          matricula: true,
          nome: true,
          utilizadoEm: true,
          createdAt: true,
          inscricao: { select: { status: true } },
        },
        orderBy: [{ utilizadoEm: 'desc' }, { createdAt: 'desc' }],
        take: 200,
      }),
    ]);

    return {
      permiteFuncionarios: evento.permiteFuncionarios,
      percentualFuncionarios:
        evento.percentualFuncionarios === null ? null : Number(evento.percentualFuncionarios),
      vagasFuncionarios: evento.vagasFuncionarios,
      nomeEmpresaFuncionarios: evento.nomeEmpresaFuncionarios,
      totalCadastrados: total,
      totalUtilizados: utilizados,
      vagasRestantes: evento.vagasFuncionarios
        ? Math.max(0, evento.vagasFuncionarios - utilizados)
        : null,
      // `emUso` ja considera cancelada/expirada como livre de novo
      funcionarios: lista.map(({ inscricao, ...f }) => ({
        ...f,
        emUso: funcionarioEstaEmUso({ inscricao }),
      })),
    };
  }

  async removerNaoUtilizados(usuarioId: string, eventoId: string) {
    await this.getEventoDoOrganizadorOuFalhar(usuarioId, eventoId);

    const res = await this.prisma.funcionarioEmpresa.deleteMany({
      where: { eventoId, ...FILTRO_FUNCIONARIO_LIVRE },
    });

    return {
      sucesso: true,
      removidos: res.count,
      mensagem: `${res.count} funcionário(s) sem inscrição foram removidos da lista.`,
    };
  }
}
