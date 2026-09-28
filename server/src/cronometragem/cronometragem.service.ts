import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  StatusResultado,
  TipoPontoCronometragem,
  OrigemPassagemCronometragem,
} from '../generated/prisma/enums';
import { WebhookResultadoDto } from './dto/webhook-resultado.dto';
import { ImportarCsvResultadoDto } from './dto/importar-csv-resultado.dto';
import { CriarSolicitacaoDto } from './dto/criar-solicitacao.dto';
import { ItemPassagemDto } from './dto/enviar-passagem.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class CronometragemService {
  constructor(private readonly prisma: PrismaService) {}

  // =========================================================================
  // INTEGRAÇÃO COM SEUPERCURSO MARK (DESKTOP)
  // =========================================================================

  /**
   * GET /cronometragem/conta
   * Retorna os dados da conta logada e a validade da licença anual da cronometradora.
   */
  async getConta(userId: string) {
    const vinculo = await this.prisma.usuarioCronometragem.findUnique({
      where: { usuarioId: userId },
      include: {
        cronometradora: true,
        usuario: {
          include: {
            cliente: {
              include: { pf: true, pj: true },
            },
          },
        },
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

    if (new Date(crono.assinaturaValidaAte) < new Date()) {
      const dataFormatada = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
      }).format(new Date(crono.assinaturaValidaAte));

      throw new ForbiddenException(
        `A assinatura anual da ${crono.nome} venceu em ${dataFormatada}. Renove em seupercurso.esp.br.`,
      );
    }

    const nome =
      vinculo.usuario.cliente?.pf?.nomeCompleto ||
      vinculo.usuario.cliente?.pj?.razaoSocial ||
      vinculo.usuario.email.split('@')[0];

    return {
      id: vinculo.usuario.id,
      nome,
      email: vinculo.usuario.email,
      papel: vinculo.papel.toLowerCase(),
      assinatura: {
        plano: crono.plano,
        valida_ate: crono.assinaturaValidaAte.toISOString(),
      },
    };
  }

  /**
   * GET /cronometragem/provas/busca?nome=
   * Busca provas públicas pelo nome (mínimo 3 letras). Nunca retorna dados de atletas.
   */
  async buscarProvas(nome: string) {
    if (!nome || nome.trim().length < 3) {
      throw new BadRequestException('A busca exige ao menos 3 letras.');
    }

    const eventos = await this.prisma.evento.findMany({
      where: {
        status: { in: ['PUBLICADO', 'INSCRICOES_ENCERRADAS', 'FINALIZADO'] },
        nome: { contains: nome.trim(), mode: 'insensitive' },
      },
      include: {
        organizador: {
          include: {
            cliente: { include: { pf: true, pj: true } },
          },
        },
      },
      take: 20,
      orderBy: { dataInicio: 'desc' },
    });

    return eventos.map((ev) => ({
      id: ev.id,
      nome: ev.nome,
      data: ev.dataInicio.toISOString().slice(0, 10),
      local: ev.local || `${ev.cidade}/${ev.estado}`,
      organizador:
        ev.organizador?.cliente?.pf?.nomeCompleto ||
        ev.organizador?.cliente?.pj?.nomeFantasia ||
        null,
    }));
  }

  /**
   * POST /cronometragem/solicitacoes
   * Cronometrista pede acesso aos inscritos de uma prova.
   */
  async criarSolicitacao(
    userId: string,
    cronometradoraId: string,
    dto: CriarSolicitacaoDto,
  ) {
    const evento = await this.prisma.evento.findUnique({
      where: { id: dto.prova_id },
      include: {
        organizador: {
          include: {
            cliente: { include: { pf: true, pj: true } },
          },
        },
      },
    });

    if (!evento) {
      throw new NotFoundException('Prova não encontrada.');
    }

    const existente = await this.prisma.solicitacaoCronometragem.findFirst({
      where: {
        cronometradoraId,
        eventoId: dto.prova_id,
        status: { in: ['PENDENTE', 'APROVADA'] },
      },
    });

    if (existente) {
      throw new ConflictException(
        'Já existe uma solicitação pendente ou aprovada para esta prova.',
      );
    }

    const solicitacao = await this.prisma.solicitacaoCronometragem.create({
      data: {
        cronometradoraId,
        eventoId: dto.prova_id,
        status: 'PENDENTE',
        mensagem: dto.mensagem,
      },
    });

    await this.prisma.auditoriaCronometragem
      .create({
        data: {
          usuarioId: userId,
          cronometradoraId,
          eventoId: dto.prova_id,
          acao: 'SOLICITOU_ACESSO',
          detalhe: dto.mensagem,
        },
      })
      .catch(() => null);

    return {
      id: solicitacao.id,
      prova: {
        id: evento.id,
        nome: evento.nome,
        data: evento.dataInicio.toISOString().slice(0, 10),
        local: evento.local || `${evento.cidade}/${evento.estado}`,
        organizador:
          evento.organizador?.cliente?.pf?.nomeCompleto ||
          evento.organizador?.cliente?.pj?.nomeFantasia ||
          null,
      },
      status: solicitacao.status.toLowerCase(),
      criada_em: solicitacao.createdAt.toISOString(),
      respondida_em: null,
      valida_ate: null,
      resposta: null,
    };
  }

  /**
   * GET /cronometragem/solicitacoes
   * Lista os pedidos da cronometradora logada.
   */
  async listarSolicitacoes(cronometradoraId: string) {
    const solicitacoes = await this.prisma.solicitacaoCronometragem.findMany({
      where: { cronometradoraId },
      include: {
        evento: {
          include: {
            organizador: {
              include: { cliente: { include: { pf: true, pj: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return solicitacoes.map((sol) => ({
      id: sol.id,
      prova: {
        id: sol.evento.id,
        nome: sol.evento.nome,
        data: sol.evento.dataInicio.toISOString().slice(0, 10),
        local: sol.evento.local || `${sol.evento.cidade}/${sol.evento.estado}`,
        organizador:
          sol.evento.organizador?.cliente?.pf?.nomeCompleto ||
          sol.evento.organizador?.cliente?.pj?.nomeFantasia ||
          null,
      },
      status: sol.status.toLowerCase(),
      criada_em: sol.createdAt.toISOString(),
      respondida_em: sol.respondidaEm ? sol.respondidaEm.toISOString() : null,
      valida_ate: sol.validaAte ? sol.validaAte.toISOString() : null,
      resposta: sol.resposta,
    }));
  }

  /**
   * GET /cronometragem/provas
   * Provas com pedido aprovado e dentro da validade.
   */
  async listarProvasLiberadas(cronometradoraId: string) {
    const agora = new Date();
    const solicitacoes = await this.prisma.solicitacaoCronometragem.findMany({
      where: {
        cronometradoraId,
        status: 'APROVADA',
        OR: [{ validaAte: null }, { validaAte: { gte: agora } }],
      },
      include: {
        evento: {
          include: {
            organizador: {
              include: { cliente: { include: { pf: true, pj: true } } },
            },
          },
        },
      },
      orderBy: { evento: { dataInicio: 'desc' } },
    });

    return solicitacoes.map((s) => ({
      id: s.evento.id,
      nome: s.evento.nome,
      data: s.evento.dataInicio.toISOString().slice(0, 10),
      local: s.evento.local || `${s.evento.cidade}/${s.evento.estado}`,
      organizador:
        s.evento.organizador?.cliente?.pf?.nomeCompleto ||
        s.evento.organizador?.cliente?.pj?.nomeFantasia ||
        null,
    }));
  }

  /**
   * GET /cronometragem/provas/:id/inscritos
   * Retorna os inscritos no formato exato que o Mark espera.
   */
  async baixarInscritos(
    userId: string,
    cronometradoraId: string,
    eventoId: string,
  ) {
    const agora = new Date();
    const solicitacao = await this.prisma.solicitacaoCronometragem.findFirst({
      where: {
        cronometradoraId,
        eventoId,
        status: 'APROVADA',
        OR: [{ validaAte: null }, { validaAte: { gte: agora } }],
      },
    });

    if (!solicitacao) {
      throw new ForbiddenException(
        'Você não possui autorização aprovada para acessar os inscritos desta prova.',
      );
    }

    const evento = await this.prisma.evento.findUnique({
      where: { id: eventoId },
      include: {
        modalidades: {
          include: {
            categorias: true,
          },
        },
      },
    });

    if (!evento) {
      throw new NotFoundException('Prova não encontrada.');
    }

    const inscricoes = await this.prisma.inscricao.findMany({
      where: {
        categoria: { modalidade: { eventoId } },
        status: 'CONFIRMADA',
      },
      include: {
        cliente: { include: { pf: true } },
        dependente: true,
        categoria: { include: { modalidade: true } },
      },
      orderBy: { dataInscricao: 'asc' },
    });

    const chips = await this.prisma.chipsCronometragem.findMany({
      where: { eventoId },
    });
    const chipMap = new Map<number, string>();
    for (const c of chips) {
      chipMap.set(c.numeroPeito, c.tagEpc);
    }

    const categoriasOut: any[] = [];
    const largadasOut: any[] = [];
    const catSet = new Set<string>();

    for (const mod of evento.modalidades) {
      largadasOut.push({
        id: mod.id,
        nome: mod.nome,
        horario_previsto: evento.dataInicio.toISOString(),
      });

      for (const cat of mod.categorias) {
        if (!catSet.has(cat.id)) {
          catSet.add(cat.id);
          categoriasOut.push({
            id: cat.id,
            nome: `${mod.nome} - ${cat.nome}`,
            sexo:
              cat.genero === 'MASCULINO'
                ? 'M'
                : cat.genero === 'FEMININO'
                  ? 'F'
                  : null,
            idade_min: cat.idadeMinima,
            idade_max: cat.idadeMaxima,
          });
        }
      }
    }

    if (largadasOut.length === 0) {
      largadasOut.push({
        id: 'padrao',
        nome: 'Geral',
        horario_previsto: evento.dataInicio.toISOString(),
      });
    }

    const atletasOut: any[] = [];
    let autoPeito = 1;
    const peitoUsados = new Set<number>();

    for (const ins of inscricoes) {
      const nome =
        ins.atletaNome ||
        ins.dependente?.nomeCompleto ||
        ins.cliente?.pf?.nomeCompleto ||
        'Atleta';
      const dataNasc =
        ins.atletaDataNascimento ||
        ins.dependente?.dataNascimento ||
        ins.cliente?.pf?.dataNascimento ||
        null;
      const genero =
        ins.atletaGenero ||
        ins.dependente?.genero ||
        ins.cliente?.pf?.genero ||
        null;

      let peito = ins.numeroPeito ? parseInt(ins.numeroPeito, 10) : NaN;
      if (isNaN(peito) || peito <= 0 || peitoUsados.has(peito)) {
        while (peitoUsados.has(autoPeito)) {
          autoPeito++;
        }
        peito = autoPeito;
      }
      peitoUsados.add(peito);

      const tagEpc =
        chipMap.get(peito) || `E${peito.toString().padStart(6, '0')}`;

      atletasOut.push({
        id: ins.id,
        nome,
        numero_peito: peito,
        tag_epc: tagEpc,
        categoria_id: ins.categoriaId,
        largada_id: ins.categoria?.modalidadeId || largadasOut[0].id,
        sexo: genero === 'MASCULINO' ? 'M' : genero === 'FEMININO' ? 'F' : null,
        data_nascimento: dataNasc ? dataNasc.toISOString().slice(0, 10) : null,
        equipe: null,
        perna: null,
      });
    }

    await this.prisma.auditoriaCronometragem
      .create({
        data: {
          usuarioId: userId,
          cronometradoraId,
          eventoId,
          acao: 'BAIXOU_INSCRITOS',
          detalhe: `${atletasOut.length} atletas confirmados baixados`,
        },
      })
      .catch(() => null);

    const primeiraDistancia = evento.modalidades[0]?.distanciaKm
      ? Number(evento.modalidades[0].distanciaKm)
      : null;

    return {
      prova: {
        id: evento.id,
        nome: evento.nome,
        data: evento.dataInicio.toISOString().slice(0, 10),
        local: evento.local || `${evento.cidade}/${evento.estado}`,
        distancia_km: primeiraDistancia,
      },
      largadas: largadasOut,
      categorias: categoriasOut,
      atletas: atletasOut,
    };
  }

  /**
   * POST /cronometragem/passagens
   * Recebe lote de passagens do Mark e faz upsert com chave composta.
   */
  async receberPassagens(
    userId: string,
    cronometradoraId: string,
    itens: ItemPassagemDto[],
  ) {
    if (!itens || itens.length === 0) {
      return { recebidas: 0, novas: 0 };
    }

    const eventoId = itens[0].prova_id;
    const solicitacao = await this.prisma.solicitacaoCronometragem.findFirst({
      where: {
        cronometradoraId,
        eventoId,
        status: 'APROVADA',
      },
    });

    if (!solicitacao) {
      throw new ForbiddenException(
        'Você não possui autorização aprovada para enviar passagens desta prova.',
      );
    }

    let novas = 0;
    for (const p of itens) {
      const pontoTipoEnum = p.ponto_tipo.toUpperCase() as TipoPontoCronometragem;
      const origemEnum = (
        p.origem ? p.origem.toUpperCase() : 'RFID'
      ) as OrigemPassagemCronometragem;

      const result = await this.prisma.passagemCronometragem.upsert({
        where: {
          notebookId_idLocal_eventoId: {
            notebookId: p.notebook_id,
            idLocal: p.id_local,
            eventoId: p.prova_id,
          },
        },
        create: {
          notebookId: p.notebook_id,
          idLocal: p.id_local,
          cronometradoraId,
          eventoId: p.prova_id,
          atletaId: p.atleta_id || null,
          numeroPeito: p.numero_peito || null,
          tagEpc: p.tag_epc || null,
          passagemEm: new Date(p.passagem_em),
          ponto: p.ponto,
          pontoTipo: pontoTipoEnum,
          origem: origemEnum,
          invalidada: p.invalidada ?? false,
        },
        update: {
          invalidada: p.invalidada ?? false,
          updatedAt: new Date(),
        },
      });

      if (result.createdAt.getTime() === result.updatedAt.getTime()) {
        novas++;
      }
    }

    return {
      recebidas: itens.length,
      novas,
    };
  }

  // =========================================================================
  // GESTÃO DO ORGANIZADOR (Aprovar / Recusar solicitações)
  // =========================================================================

  async listarSolicitacoesDoEvento(usuarioId: string, eventoId: string) {
    await this.getEventoDoOrganizadorOuFalhar(usuarioId, eventoId);

    const solicitacoes = await this.prisma.solicitacaoCronometragem.findMany({
      where: { eventoId },
      include: {
        cronometradora: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return solicitacoes.map((s) => ({
      id: s.id,
      cronometradora: {
        id: s.cronometradora.id,
        nome: s.cronometradora.nome,
        documento: s.cronometradora.documento,
      },
      status: s.status.toLowerCase(),
      mensagem: s.mensagem,
      resposta: s.resposta,
      valida_ate: s.validaAte ? s.validaAte.toISOString() : null,
      criada_em: s.createdAt.toISOString(),
      respondida_em: s.respondidaEm ? s.respondidaEm.toISOString() : null,
    }));
  }

  async aprovarSolicitacao(usuarioId: string, solicitacaoId: string) {
    const solicitacao = await this.prisma.solicitacaoCronometragem.findUnique({
      where: { id: solicitacaoId },
      include: { evento: true },
    });

    if (!solicitacao) {
      throw new NotFoundException('Solicitação não encontrada.');
    }

    await this.getEventoDoOrganizadorOuFalhar(usuarioId, solicitacao.eventoId);

    const validaAte = new Date(solicitacao.evento.dataFim);
    validaAte.setDate(validaAte.getDate() + 7);

    return this.prisma.solicitacaoCronometragem.update({
      where: { id: solicitacaoId },
      data: {
        status: 'APROVADA',
        respondidaEm: new Date(),
        validaAte,
      },
    });
  }

  async recusarSolicitacao(
    usuarioId: string,
    solicitacaoId: string,
    resposta?: string,
  ) {
    const solicitacao = await this.prisma.solicitacaoCronometragem.findUnique({
      where: { id: solicitacaoId },
      include: { evento: true },
    });

    if (!solicitacao) {
      throw new NotFoundException('Solicitação não encontrada.');
    }

    await this.getEventoDoOrganizadorOuFalhar(usuarioId, solicitacao.eventoId);

    return this.prisma.solicitacaoCronometragem.update({
      where: { id: solicitacaoId },
      data: {
        status: 'RECUSADA',
        resposta: resposta || 'Solicitação recusada pelo organizador.',
        respondidaEm: new Date(),
      },
    });
  }

  async revogarSolicitacao(usuarioId: string, solicitacaoId: string) {
    const solicitacao = await this.prisma.solicitacaoCronometragem.findUnique({
      where: { id: solicitacaoId },
      include: { evento: true },
    });

    if (!solicitacao) {
      throw new NotFoundException('Solicitação não encontrada.');
    }

    await this.getEventoDoOrganizadorOuFalhar(usuarioId, solicitacao.eventoId);

    return this.prisma.solicitacaoCronometragem.update({
      where: { id: solicitacaoId },
      data: {
        status: 'REVOGADA',
        respondidaEm: new Date(),
      },
    });
  }

  // =========================================================================
  // MÉTODOS EXISTENTES DO ORGANIZADOR / WEBHOOK ANTERIOR
  // =========================================================================

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

    const statusFinal = this.mapearStatusResultado(dto.status);

    const resultado = await this.prisma.resultado.upsert({
      where: { inscricaoId: inscricao.id },
      create: {
        inscricaoId: inscricao.id,
        tempoBrutoSegundos: dto.tempoBrutoSegundos,
        tempoLiquidoSegundos: dto.tempoLiquidoSegundos,
        status: statusFinal,
      },
      update: {
        tempoBrutoSegundos: dto.tempoBrutoSegundos,
        tempoLiquidoSegundos: dto.tempoLiquidoSegundos,
        status: statusFinal,
      },
    });

    await this.recalcularClassificacoes(evento.id);

    return resultado;
  }

  async importarResultadosLote(
    usuarioId: string,
    eventoId: string,
    dto: ImportarCsvResultadoDto,
  ) {
    const evento = await this.getEventoDoOrganizadorOuFalhar(usuarioId, eventoId);

    const resultadosSalvos: any[] = [];
    const erros: Array<{ linha: number; numeroPeito: any; erro: string }> = [];

    const itens = dto.resultados || [];
    for (let i = 0; i < itens.length; i++) {
      const linha = itens[i];
      try {
        const inscricao = await this.prisma.inscricao.findFirst({
          where: {
            numeroPeito: linha.numeroPeito.toString().trim(),
            categoria: { modalidade: { eventoId: evento.id } },
          },
        });

        if (!inscricao) {
          erros.push({
            linha: i + 1,
            numeroPeito: linha.numeroPeito,
            erro: 'Atleta não encontrado pelo número de peito',
          });
          continue;
        }

        const statusFinal = this.mapearStatusResultado(linha.status);

        const res = await this.prisma.resultado.upsert({
          where: { inscricaoId: inscricao.id },
          create: {
            inscricaoId: inscricao.id,
            tempoBrutoSegundos: linha.tempoBrutoSegundos,
            tempoLiquidoSegundos: linha.tempoLiquidoSegundos,
            status: statusFinal,
          },
          update: {
            tempoBrutoSegundos: linha.tempoBrutoSegundos,
            tempoLiquidoSegundos: linha.tempoLiquidoSegundos,
            status: statusFinal,
          },
        });

        resultadosSalvos.push(res);
      } catch (err: any) {
        erros.push({
          linha: i + 1,
          numeroPeito: linha.numeroPeito,
          erro: err.message,
        });
      }
    }

    await this.recalcularClassificacoes(evento.id);

    return {
      sucesso: true,
      importados: resultadosSalvos.length,
      erros,
    };
  }

  async listarResultadosEvento(usuarioId: string, eventoId: string) {
    const evento = await this.getEventoDoOrganizadorOuFalhar(usuarioId, eventoId);

    return this.prisma.resultado.findMany({
      where: {
        inscricao: {
          categoria: { modalidade: { eventoId: evento.id } },
        },
      },
      include: {
        inscricao: {
          include: {
            cliente: { include: { pf: true } },
            dependente: true,
            categoria: { include: { modalidade: true } },
          },
        },
      },
      orderBy: [
        { colocacaoGeral: 'asc' },
        { tempoBrutoSegundos: 'asc' },
      ],
    });
  }

  private async recalcularClassificacoes(eventoId: string) {
    const modalidades = await this.prisma.modalidade.findMany({
      where: { eventoId },
      include: {
        categorias: true,
      },
    });

    for (const mod of modalidades) {
      const inscricoesGeral = await this.prisma.inscricao.findMany({
        where: {
          categoria: { modalidadeId: mod.id },
          resultado: { status: StatusResultado.FINALIZADO },
        },
        include: { resultado: true },
      });

      inscricoesGeral.sort(
        (a, b) =>
          (a.resultado?.tempoBrutoSegundos || 999999) -
          (b.resultado?.tempoBrutoSegundos || 999999),
      );

      for (let index = 0; index < inscricoesGeral.length; index++) {
        const insc = inscricoesGeral[index];
        await this.prisma.resultado.update({
          where: { inscricaoId: insc.id },
          data: { colocacaoGeral: index + 1 },
        });
      }

      for (const cat of mod.categorias) {
        const inscricoesCategoria = await this.prisma.inscricao.findMany({
          where: {
            categoriaId: cat.id,
            resultado: { status: StatusResultado.FINALIZADO },
          },
          include: { resultado: true },
        });

        inscricoesCategoria.sort(
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
