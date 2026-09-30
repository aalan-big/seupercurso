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
import { EnviarChipsDto, ImportarChipsDto } from './dto/importar-chips.dto';
import { randomBytes } from 'crypto';

/** Quantos peitos de exemplo vao nas mensagens e avisos para o Mark. */
const LIMITE_EXEMPLOS_AVISO = 50;

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
    const agora = new Date();
    await this.prisma.solicitacaoCronometragem.updateMany({
      where: {
        cronometradoraId,
        status: 'APROVADA',
        OR: [{ validaAte: null }, { validaAte: { lt: agora } }],
      },
      data: {
        status: 'EXPIRADA',
      },
    });

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

    return solicitacoes.map((sol) => {
      let statusFormatado = sol.status.toLowerCase();
      if (sol.status === 'APROVADA' && (!sol.validaAte || sol.validaAte < agora)) {
        statusFormatado = 'expirada';
      }
      return {
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
        status: statusFormatado,
        criada_em: sol.createdAt.toISOString(),
        respondida_em: sol.respondidaEm ? sol.respondidaEm.toISOString() : null,
        valida_ate: sol.validaAte ? sol.validaAte.toISOString() : null,
        resposta: sol.resposta,
      };
    });
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
        validaAte: { gte: agora },
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
        validaAte: { gte: agora },
      },
    });

    if (!solicitacao) {
      throw new ForbiddenException(
        'Você não possui autorização aprovada ou a validade do acesso expirou para acessar os inscritos desta prova.',
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

    // 1. Checagem de número de peito: Bloquear download se houver atletas sem número de peito
    const semPeito = inscricoes.filter((ins) => {
      const p = ins.numeroPeito ? parseInt(ins.numeroPeito, 10) : NaN;
      return isNaN(p) || p <= 0;
    });

    if (semPeito.length > 0) {
      throw new BadRequestException(
        `Não é possível baixar inscritos: existem ${semPeito.length} atleta(s) confirmado(s) sem número de peito atribuído. O organizador precisa definir os números de peito antes do download.`,
      );
    }

    // O banco não garante peito único por prova; repetido faria dois atletas
    // dividirem o mesmo chip e o programa recusaria o download inteiro.
    const contagemPeito = new Map<number, number>();
    for (const ins of inscricoes) {
      const peito = parseInt(ins.numeroPeito!, 10);
      contagemPeito.set(peito, (contagemPeito.get(peito) || 0) + 1);
    }
    const peitosRepetidos = [...contagemPeito.entries()]
      .filter(([, total]) => total > 1)
      .map(([peito]) => peito);

    if (peitosRepetidos.length > 0) {
      const exemplos = peitosRepetidos.slice(0, 5).join(', ');
      throw new BadRequestException(
        `Não é possível baixar inscritos: ${peitosRepetidos.length} número(s) de peito estão repetidos em mais de um atleta (ex: peito(s) ${exemplos}${peitosRepetidos.length > 5 ? '...' : ''}). O organizador precisa corrigir os números de peito antes do download.`,
      );
    }

    // 2. Checagem de chips: Obter chips cadastrados para a prova
    const chips = await this.prisma.chipsCronometragem.findMany({
      where: { eventoId },
    });
    const chipMap = new Map<number, string>();
    for (const c of chips) {
      chipMap.set(c.numeroPeito, c.tagEpc);
    }

    // Chip nao bloqueia mais: a cronometragem liga os chips no Mark e envia de
    // volta (POST /cronometragem/provas/:id/chips). Quem ainda nao tem chip vem
    // com tag_epc nulo e entra no aviso.
    const semChip: number[] = [];
    for (const ins of inscricoes) {
      const peito = parseInt(ins.numeroPeito!, 10);
      if (!chipMap.has(peito)) {
        semChip.push(peito);
      }
    }
    semChip.sort((a, b) => a - b);

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

      const peito = parseInt(ins.numeroPeito!, 10);
      const tagEpc = chipMap.get(peito) ?? null;

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
          detalhe: `${atletasOut.length} atletas confirmados baixados, ${semChip.length} sem chip`,
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
      avisos: {
        atletas_sem_chip: semChip.length,
        // Lista curta: o Mark so precisa de exemplos para o aviso.
        peitos_sem_chip: semChip.slice(0, LIMITE_EXEMPLOS_AVISO),
      },
    };
  }

  /**
   * POST /cronometragem/provas/:id/chips
   * O Mark envia a ligacao peito -> chip feita pela cronometragem. Pode ser
   * chamado varias vezes: por padrao so troca os peitos enviados.
   */
  async enviarChips(
    userId: string,
    cronometradoraId: string,
    eventoId: string,
    dto: EnviarChipsDto,
  ) {
    const solicitacao = await this.prisma.solicitacaoCronometragem.findFirst({
      where: {
        cronometradoraId,
        eventoId,
        status: 'APROVADA',
        validaAte: { gte: new Date() },
      },
    });

    if (!solicitacao) {
      throw new ForbiddenException(
        'Você não possui autorização aprovada ou a validade do acesso expirou para enviar chips desta prova.',
      );
    }

    const itens = dto.chips.map((c) => ({
      numeroPeito: c.numero_peito,
      tagEpc: c.tag_epc.trim(),
    }));
    this.validarItensChips(itens);

    // So aceita peito que existe entre os confirmados: foi o que o Mark baixou.
    const peitosDaProva = await this.peitosConfirmados(eventoId);
    const desconhecidos = itens
      .map((i) => i.numeroPeito)
      .filter((p) => !peitosDaProva.has(p));
    if (desconhecidos.length > 0) {
      const exemplos = desconhecidos.slice(0, 10).join(', ');
      throw new BadRequestException(
        `${desconhecidos.length} número(s) de peito não pertencem a nenhum atleta confirmado desta prova (ex: ${exemplos}). Baixe os inscritos de novo e confira os peitos.`,
      );
    }

    await this.gravarChips(eventoId, itens, dto.substituir === true);

    const chips = await this.prisma.chipsCronometragem.findMany({
      where: { eventoId },
      select: { numeroPeito: true },
    });
    const peitosComChip = new Set(chips.map((c) => c.numeroPeito));
    const atletasSemChip = [...peitosDaProva].filter((p) => !peitosComChip.has(p)).length;

    await this.prisma.auditoriaCronometragem
      .create({
        data: {
          usuarioId: userId,
          cronometradoraId,
          eventoId,
          acao: 'ENVIOU_CHIPS',
          detalhe: `${itens.length} chips enviados${dto.substituir ? ' (substituindo todos)' : ''}, ${atletasSemChip} atleta(s) ainda sem chip`,
        },
      })
      .catch(() => null);

    return {
      gravados: itens.length,
      atletas_sem_chip: atletasSemChip,
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

    const agora = new Date();
    await this.prisma.solicitacaoCronometragem.updateMany({
      where: {
        eventoId,
        status: 'APROVADA',
        OR: [{ validaAte: null }, { validaAte: { lt: agora } }],
      },
      data: {
        status: 'EXPIRADA',
      },
    });

    const solicitacoes = await this.prisma.solicitacaoCronometragem.findMany({
      where: { eventoId },
      include: {
        cronometradora: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return solicitacoes.map((s) => {
      let statusFormatado = s.status.toLowerCase();
      if (s.status === 'APROVADA' && (!s.validaAte || s.validaAte < agora)) {
        statusFormatado = 'expirada';
      }
      return {
        id: s.id,
        cronometradora: {
          id: s.cronometradora.id,
          nome: s.cronometradora.nome,
          documento: s.cronometradora.documento,
        },
        status: statusFormatado,
        mensagem: s.mensagem,
        resposta: s.resposta,
        valida_ate: s.validaAte ? s.validaAte.toISOString() : null,
        criada_em: s.createdAt.toISOString(),
        respondida_em: s.respondidaEm ? s.respondidaEm.toISOString() : null,
      };
    });
  }

  async aprovarSolicitacao(usuarioId: string, solicitacaoId: string) {
    const solicitacao = await this.prisma.solicitacaoCronometragem.findUnique({
      where: { id: solicitacaoId },
      include: { evento: true },
    });

    if (!solicitacao) {
      throw new NotFoundException('Solicitação não encontrada.');
    }

    // Dono da prova primeiro: senão outro organizador descobriria a situação do pedido.
    await this.getEventoDoOrganizadorOuFalhar(usuarioId, solicitacao.eventoId);

    if (solicitacao.status !== 'PENDENTE') {
      throw new ConflictException(
        `Apenas solicitações com status PENDENTE podem ser aprovadas. Situação atual: ${solicitacao.status}.`,
      );
    }

    const validaAte = new Date(solicitacao.evento.dataFim);
    validaAte.setDate(validaAte.getDate() + 7);

    const atualizada = await this.prisma.solicitacaoCronometragem.update({
      where: { id: solicitacaoId },
      data: {
        status: 'APROVADA',
        respondidaEm: new Date(),
        validaAte,
      },
    });

    await this.prisma.auditoriaCronometragem
      .create({
        data: {
          usuarioId,
          cronometradoraId: solicitacao.cronometradoraId,
          eventoId: solicitacao.eventoId,
          acao: 'APROVOU',
          detalhe: 'Solicitação de acesso aprovada pelo organizador',
        },
      })
      .catch(() => null);

    return atualizada;
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

    if (solicitacao.status !== 'PENDENTE') {
      throw new ConflictException(
        `Apenas solicitações com status PENDENTE podem ser recusadas. Situação atual: ${solicitacao.status}.`,
      );
    }

    const atualizada = await this.prisma.solicitacaoCronometragem.update({
      where: { id: solicitacaoId },
      data: {
        status: 'RECUSADA',
        resposta: resposta || 'Solicitação recusada pelo organizador.',
        respondidaEm: new Date(),
      },
    });

    await this.prisma.auditoriaCronometragem
      .create({
        data: {
          usuarioId,
          cronometradoraId: solicitacao.cronometradoraId,
          eventoId: solicitacao.eventoId,
          acao: 'RECUSOU',
          detalhe: `Solicitação recusada pelo organizador. Resposta: ${resposta || 'Sem mensagem'}`,
        },
      })
      .catch(() => null);

    return atualizada;
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

    if (solicitacao.status !== 'APROVADA') {
      throw new ConflictException(
        `Apenas solicitações com status APROVADA podem ser revogadas. Situação atual: ${solicitacao.status}.`,
      );
    }

    const atualizada = await this.prisma.solicitacaoCronometragem.update({
      where: { id: solicitacaoId },
      data: {
        status: 'REVOGADA',
        respondidaEm: new Date(),
      },
    });

    await this.prisma.auditoriaCronometragem
      .create({
        data: {
          usuarioId,
          cronometradoraId: solicitacao.cronometradoraId,
          eventoId: solicitacao.eventoId,
          acao: 'REVOGOU',
          detalhe: 'Acesso da cronometradora revogado pelo organizador',
        },
      })
      .catch(() => null);

    return atualizada;
  }

  /**
   * Importa lista de chips peito -> tag_epc para o evento
   */
  async importarChips(
    usuarioId: string,
    eventoId: string,
    dto: ImportarChipsDto,
  ) {
    await this.getEventoDoOrganizadorOuFalhar(usuarioId, eventoId);

    const itensParaProcessar: Array<{ numeroPeito: number; tagEpc: string }> = [];

    // Se enviou array de chips estruturado
    if (dto.chips && Array.isArray(dto.chips)) {
      for (const c of dto.chips) {
        if (c.numeroPeito && c.tagEpc) {
          itensParaProcessar.push({
            numeroPeito: Number(c.numeroPeito),
            tagEpc: String(c.tagEpc).trim(),
          });
        }
      }
    }

    // Se enviou conteúdo CSV em texto
    if (dto.csvContent && dto.csvContent.trim()) {
      const linhas = dto.csvContent.trim().split(/\r?\n/);
      for (let i = 0; i < linhas.length; i++) {
        const linha = linhas[i].trim();
        if (!linha) continue;

        const partes = linha.split(/[,;\t]/).map((p) => p.trim());
        if (partes.length < 2) continue;

        // Cabeçalho é a primeira linha sem número na coluna do peito. Olhar o
        // texto da tag descartava um chip real como "EPC0001" sem avisar.
        if (i === 0 && isNaN(parseInt(partes[0], 10))) {
          continue;
        }

        const numPeito = parseInt(partes[0], 10);
        const tag = partes[1];

        if (!isNaN(numPeito) && numPeito > 0 && tag) {
          itensParaProcessar.push({
            numeroPeito: numPeito,
            tagEpc: tag,
          });
        }
      }
    }

    if (itensParaProcessar.length === 0) {
      throw new BadRequestException(
        'Nenhum dado válido de chip (numero_peito, tag_epc) foi encontrado no arquivo ou texto enviado.',
      );
    }

    this.validarItensChips(itensParaProcessar);

    const substituir = dto.substituir !== false; // padrão true para planilha completa
    await this.gravarChips(eventoId, itensParaProcessar, substituir);

    return {
      sucesso: true,
      totalProcessados: itensParaProcessar.length,
      substituidos: substituir,
    };
  }

  async obterResumoChips(usuarioId: string, eventoId: string) {
    await this.getEventoDoOrganizadorOuFalhar(usuarioId, eventoId);

    const [chips, inscricoes, ultimoEnvio] = await Promise.all([
      this.prisma.chipsCronometragem.findMany({
        where: { eventoId },
        select: { numeroPeito: true },
      }),
      this.prisma.inscricao.findMany({
        where: {
          categoria: { modalidade: { eventoId } },
          status: 'CONFIRMADA',
        },
        select: {
          id: true,
          numeroPeito: true,
        },
      }),
      this.prisma.auditoriaCronometragem.findFirst({
        where: { eventoId, acao: 'ENVIOU_CHIPS' },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, cronometradora: { select: { nome: true } } },
      }),
    ]);

    const totalInscritos = inscricoes.length;
    const peitos = inscricoes
      .map((ins) => (ins.numeroPeito ? parseInt(ins.numeroPeito, 10) : NaN))
      .filter((p) => !isNaN(p) && p > 0);
    const peitosComChip = new Set(chips.map((c) => c.numeroPeito));

    return {
      totalChips: chips.length,
      totalInscritos,
      inscritosComPeito: peitos.length,
      atletasSemChip: peitos.filter((p) => !peitosComChip.has(p)).length,
      ultimoEnvioCronometragem: ultimoEnvio
        ? {
            em: ultimoEnvio.createdAt,
            cronometradora: ultimoEnvio.cronometradora?.nome ?? null,
          }
        : null,
    };
  }

  /** Mesmo peito ou mesmo chip duas vezes na lista faria dois atletas dividirem um chip. */
  private validarItensChips(itens: Array<{ numeroPeito: number; tagEpc: string }>) {
    const peitosVistos = new Set<number>();
    const tagsVistas = new Set<string>();
    for (const item of itens) {
      if (!item.tagEpc) {
        throw new BadRequestException(
          `O número de peito #${item.numeroPeito} está sem código de chip (tag EPC).`,
        );
      }
      if (peitosVistos.has(item.numeroPeito)) {
        throw new BadRequestException(
          `O número de peito #${item.numeroPeito} aparece mais de uma vez na lista enviada. Cada número de peito deve ser único.`,
        );
      }
      peitosVistos.add(item.numeroPeito);

      if (tagsVistas.has(item.tagEpc.toUpperCase())) {
        throw new BadRequestException(
          `A tag EPC "${item.tagEpc}" aparece mais de uma vez na lista enviada. Cada tag de chip deve ser única.`,
        );
      }
      tagsVistas.add(item.tagEpc.toUpperCase());
    }
  }

  /**
   * Grava a ligacao peito -> chip numa transacao so. Sem `substituir`, apaga
   * antes as linhas que usam os mesmos peitos OU os mesmos chips: a tabela e
   * unica nos dois, e trocar o chip de dois peitos com upsert quebrava no meio.
   */
  private async gravarChips(
    eventoId: string,
    itens: Array<{ numeroPeito: number; tagEpc: string }>,
    substituir: boolean,
  ) {
    const limpar = substituir
      ? { eventoId }
      : {
          eventoId,
          OR: [
            { numeroPeito: { in: itens.map((i) => i.numeroPeito) } },
            { tagEpc: { in: itens.map((i) => i.tagEpc) } },
          ],
        };

    await this.prisma.$transaction([
      this.prisma.chipsCronometragem.deleteMany({ where: limpar }),
      this.prisma.chipsCronometragem.createMany({
        data: itens.map((item) => ({
          eventoId,
          numeroPeito: item.numeroPeito,
          tagEpc: item.tagEpc,
        })),
      }),
    ]);
  }

  /** Peitos validos dos atletas confirmados: exatamente os que o download entrega. */
  private async peitosConfirmados(eventoId: string) {
    const inscricoes = await this.prisma.inscricao.findMany({
      where: {
        categoria: { modalidade: { eventoId } },
        status: 'CONFIRMADA',
      },
      select: { numeroPeito: true },
    });
    const peitos = new Set<number>();
    for (const ins of inscricoes) {
      const p = ins.numeroPeito ? parseInt(ins.numeroPeito, 10) : NaN;
      if (!isNaN(p) && p > 0) peitos.add(p);
    }
    return peitos;
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
