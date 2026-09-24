import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { access } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import {
  MetodoPagamento,
  StatusDocumentoIdoso,
  StatusInscricao,
  StatusPagamento,
} from '../generated/prisma/enums';
import { calcularValorInscricao } from '../common/calcular-valor-inscricao';
import { calcularIdade } from '../common/calcular-idade';
import {
  FILTRO_SERVIDOR_EM_USO,
  FILTRO_SERVIDOR_LIVRE,
  servidorEstaEmUso,
} from '../common/servidor-publico-em-uso';
import { CreateInscricaoDto } from './dto/create-inscricao.dto';
import { CreateInscricaoBatchDto } from './dto/create-inscricao-batch.dto';
import { ValidarServidorDto } from './dto/validar-servidor.dto';
import { EmailService } from '../email/email.service';

@Injectable()
export class InscricaoService {
  private readonly logger = new Logger(InscricaoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async create(usuarioId: string, dto: CreateInscricaoDto) {
    const cliente = await this.getClienteComPfOuFalhar(usuarioId);
    const clienteId = cliente.id;

    const categoria = await this.prisma.categoria.findUnique({
      where: { id: dto.categoriaId },
      include: { modalidade: { include: { evento: true } } },
    });
    if (!categoria) {
      throw new NotFoundException('Categoria não encontrada.');
    }

    // A validacao da matricula so existe no carrinho (createBatch). Por aqui a
    // categoria de servidor seria cobrada a preco cheio sem conferir a lista.
    if (categoria.servidorPublico) {
      throw new BadRequestException(
        'Inscrições na categoria Servidor Público são feitas pela página do evento.',
      );
    }

    this.validarElegibilidadeCategoria(
      categoria,
      cliente.pf,
      categoria.modalidade.evento.dataInicio,
    );

    await this.garantirVagaNaCategoria(categoria.id, categoria.capacidade);
    await this.garantirVagaNaModalidade(
      categoria.modalidadeId,
      categoria.modalidade.capacidade,
    );
    await this.garantirVagaNoEvento(
      categoria.modalidade.eventoId,
      categoria.modalidade.evento.capacidade,
    );

    const loteRequisitado = await this.prisma.lote.findUnique({
      where: { id: dto.loteId },
    });
    if (!loteRequisitado) {
      throw new NotFoundException('Lote não encontrado.');
    }

    if (categoria.modalidade.eventoId !== loteRequisitado.eventoId) {
      throw new BadRequestException(
        'A categoria e o lote precisam ser do mesmo evento.',
      );
    }

    const lote = await this.resolverLoteDisponivel(
      loteRequisitado.eventoId,
      categoria.modalidadeId,
    );

    const inscricaoPendenteAnterior = await this.prisma.inscricao.findFirst({
      where: {
        clienteId,
        status: StatusInscricao.PENDENTE_PAGAMENTO,
        categoria: { modalidade: { eventoId: lote.eventoId } },
      },
    });

    if (inscricaoPendenteAnterior) {
      // Se havia uma tentativa pendente anterior não paga, cancela para liberar a vaga e o cupom
      await this.prisma.inscricao.update({
        where: { id: inscricaoPendenteAnterior.id },
        data: { status: StatusInscricao.CANCELADA },
      });
    }

    const inscricaoConfirmada = await this.prisma.inscricao.findFirst({
      where: {
        clienteId,
        status: StatusInscricao.CONFIRMADA,
        categoria: { modalidade: { eventoId: lote.eventoId } },
      },
    });
    if (inscricaoConfirmada) {
      throw new ConflictException(
        'Você já tem uma inscrição confirmada e paga para este evento.',
      );
    }

    const cupomId = dto.cupomCodigo
      ? await this.resolverCupomOuFalhar(lote.eventoId, dto.cupomCodigo)
      : null;

    // validarElegibilidadeCategoria ja barrou perfil sem PF; o `!` so repete
    // isso para o compilador.
    const documentoIdosoUrl = await this.resolverDocumentoIdoso(
      categoria.modalidade.evento,
      cliente.pf!.dataNascimento,
      cliente.pf!.nomeCompleto,
      dto.documentoIdosoUrl,
      !categoria.servidorPublico,
    );

    const evento = categoria.modalidade.evento;
    const querCamisa =
      evento.possuiCamisa && (!evento.camisaOpcional || !!dto.incluiCamisa);

    const valor = await calcularValorInscricao(this.prisma, {
      loteId: lote.id,
      modalidadeId: categoria.modalidadeId,
      clienteId,
      eventoId: lote.eventoId,
      cupomId,
      incluiCamisa: querCamisa,
    });

    const modeloCamisaId = querCamisa
      ? await this.resolverModeloCamisa(lote.eventoId, dto.modeloCamisaId)
      : null;

    const inscricao = await this.prisma.$transaction(async (tx) => {
      if (cupomId) {
        await tx.cupom.update({
          where: { id: cupomId },
          data: { usosAtuais: { increment: 1 } },
        });
      }

      return tx.inscricao.create({
        data: {
          clienteId,
          categoriaId: dto.categoriaId,
          loteId: lote.id,
          cupomId,
          incluiCamisa: querCamisa,
          valorCamisa:
            evento.camisaOpcional && querCamisa && evento.valorCamisaOpcional
              ? evento.valorCamisaOpcional
              : null,
          modeloCamisaId,
          tamanhoCamisa: querCamisa ? dto.tamanhoCamisa || null : null,
          documentoIdosoUrl,
          documentoIdosoStatus: documentoIdosoUrl
            ? StatusDocumentoIdoso.PENDENTE
            : null,
          status: StatusInscricao.PENDENTE_PAGAMENTO,
        },
      });
    });

    return { ...inscricao, valor };
  }

  async validarServidor(dto: ValidarServidorDto) {
    const cpfLimpo = dto.cpf.replace(/\D/g, '');
    const matriculaLimpa = dto.matricula.trim();

    const evento = await this.prisma.evento.findUnique({
      where: { id: dto.eventoId },
      select: { permiteServidorPublico: true, vagasServidorPublico: true, nome: true },
    });

    if (!evento) {
      throw new NotFoundException('Evento não encontrado.');
    }

    if (!evento.permiteServidorPublico) {
      throw new BadRequestException('A categoria de servidor público com isenção não está liberada para este evento.');
    }

    // Checa se o limite de vagas gratuitas já foi atingido
    if (evento.vagasServidorPublico !== null) {
      const vagasUtilizadas = await this.prisma.servidorPublico.count({
        where: { eventoId: dto.eventoId, ...FILTRO_SERVIDOR_EM_USO },
      });
      if (vagasUtilizadas >= evento.vagasServidorPublico) {
        throw new BadRequestException(
          `O limite de vagas gratuitas para servidores públicos neste evento (${evento.vagasServidorPublico} vagas) já foi esgotado.`,
        );
      }
    }

    const servidor = await this.prisma.servidorPublico.findFirst({
      where: {
        eventoId: dto.eventoId,
        cpf: cpfLimpo,
        matricula: { equals: matriculaLimpa, mode: 'insensitive' },
      },
      include: { inscricao: { select: { status: true } } },
    });

    if (!servidor) {
      throw new NotFoundException(
        'Matrícula ou CPF não localizados na lista oficial de servidores públicos deste evento.',
      );
    }

    if (servidorEstaEmUso(servidor)) {
      throw new ConflictException(
        'Esta matrícula e CPF já foram utilizados para uma inscrição gratuita neste evento.',
      );
    }

    // Sem o nome: a resposta confirmaria a identidade de quem esta na lista
    // para qualquer um que acertasse CPF + matricula.
    return {
      valido: true,
      matricula: servidor.matricula,
      mensagem: 'Matrícula confirmada. Inscrição 100% gratuita liberada.',
    };
  }

  // Nao exige mais e-mail confirmado: em 24/09 metade das tentativas de compra
  // parava nessa trava (189 contas sem confirmar em 3 dias). O pagamento passa
  // pelo Mercado Pago de qualquer jeito; o e-mail certo e conferido na tela de
  // pagamento, e o voucher fica sempre em "Meus Eventos".
  async createBatch(usuarioId: string, dto: CreateInscricaoBatchDto) {
    const cliente = await this.getClienteComPfOuFalhar(usuarioId);
    const clienteId = cliente.id;

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Selecione ao menos um participante para a inscrição.');
    }

    const inscricoesParaCriar: Array<{
      categoriaId: string;
      loteId: string;
      cupomId: string | null;
      incluiCamisa?: boolean;
      valorCamisa?: any;
      modeloCamisaId?: string | null;
      tamanhoCamisa: string | null;
      dependenteId: string | null;
      atletaNome: string;
      atletaCpf: string;
      atletaDataNascimento: Date;
      atletaGenero: any;
      atletaPcd: boolean;
      documentoIdosoUrl: string | null;
      valor: number;
      isServidorPublico?: boolean;
      matriculaServidor?: string | null;
      servidorPublicoId?: string | null;
    }> = [];

    const cpfsNoCarrinho = new Set<string>();
    // Servidores ja aceitos neste carrinho: ainda nao estao no banco, entao a
    // contagem de vagas nao os enxerga sozinha.
    let servidoresNoCarrinho = 0;

    for (const item of dto.items) {
      let atletaNome: string;
      let atletaCpf: string;
      let atletaDataNascimento: Date;
      let atletaGenero: any;
      let atletaPcd = false;
      let dependenteId: string | null = null;

      if (item.dependenteId) {
        const dependente = await this.prisma.dependente.findFirst({
          where: { id: item.dependenteId, clienteId },
        });
        if (!dependente) {
          throw new NotFoundException(`Dependente informado não encontrado.`);
        }
        dependenteId = dependente.id;
        atletaNome = dependente.nomeCompleto;
        atletaCpf = dependente.cpf;
        atletaDataNascimento = dependente.dataNascimento;
        atletaGenero = dependente.genero;
        atletaPcd = dependente.pcd;
      } else if (item.atleta) {
        atletaNome = item.atleta.nomeCompleto.trim();
        atletaCpf = item.atleta.cpf.replace(/\D/g, '');
        atletaDataNascimento = new Date(item.atleta.dataNascimento);
        atletaGenero = item.atleta.genero;
        atletaPcd = item.atleta.pcd ?? false;
      } else {
        if (!cliente.pf) {
          throw new BadRequestException('Complete seu perfil de pessoa física antes de se inscrever.');
        }
        atletaNome = cliente.pf.nomeCompleto;
        atletaCpf = cliente.pf.cpf;
        atletaDataNascimento = cliente.pf.dataNascimento;
        atletaGenero = cliente.pf.genero;
        atletaPcd = cliente.pf.pcd;
      }

      if (cpfsNoCarrinho.has(atletaCpf)) {
        throw new ConflictException(`O atleta com CPF ${atletaCpf} foi adicionado mais de uma vez no mesmo pedido.`);
      }
      cpfsNoCarrinho.add(atletaCpf);

      const categoria = await this.prisma.categoria.findUnique({
        where: { id: item.categoriaId },
        include: { modalidade: { include: { evento: true } } },
      });
      if (!categoria) {
        throw new NotFoundException('Categoria não encontrada.');
      }

      this.validarElegibilidadeCategoria(
        categoria,
        { dataNascimento: atletaDataNascimento, genero: atletaGenero, pcd: atletaPcd },
        categoria.modalidade.evento.dataInicio,
      );

      await this.garantirVagaNaCategoria(categoria.id, categoria.capacidade);
      await this.garantirVagaNaModalidade(
        categoria.modalidadeId,
        categoria.modalidade.capacidade,
      );
      await this.garantirVagaNoEvento(
        categoria.modalidade.eventoId,
        categoria.modalidade.evento.capacidade,
      );

      const loteRequisitado = await this.prisma.lote.findUnique({
        where: { id: item.loteId },
      });
      if (!loteRequisitado) {
        throw new NotFoundException('Lote não encontrado.');
      }

      if (categoria.modalidade.eventoId !== loteRequisitado.eventoId) {
        throw new BadRequestException('A categoria e o lote precisam ser do mesmo evento.');
      }

      const lote = await this.resolverLoteDisponivel(
        loteRequisitado.eventoId,
        categoria.modalidadeId,
      );

      // Checa se o mesmo atleta já tem inscrição confirmada no evento
      const jaInscrito = await this.prisma.inscricao.findFirst({
        where: {
          status: StatusInscricao.CONFIRMADA,
          categoria: { modalidade: { eventoId: lote.eventoId } },
          OR: [
            { atletaCpf: atletaCpf },
            { cliente: { pf: { cpf: atletaCpf } } },
            { dependente: { cpf: atletaCpf } },
          ],
        },
      });
      if (jaInscrito) {
        throw new ConflictException(`O atleta ${atletaNome} (CPF ${atletaCpf}) já possui uma inscrição confirmada para este evento.`);
      }

      const cupomId = item.cupomCodigo
        ? await this.resolverCupomOuFalhar(lote.eventoId, item.cupomCodigo)
        : null;

      let isServidorPublico = false;
      let matriculaServidor: string | null = null;
      let servidorPublicoId: string | null = null;

      // O servidor da lista disputa qualquer categoria de graca (Geral, faixa de
      // idade...). Na categoria marcada como Servidor Publico a matricula e
      // obrigatoria; nas demais, so conta se vier informada.
      if (categoria.servidorPublico || item.matriculaServidor) {
        if (!categoria.modalidade.evento.permiteServidorPublico) {
          throw new BadRequestException('A categoria de servidor público com isenção não está liberada para este evento.');
        }

        if (!item.matriculaServidor) {
          throw new BadRequestException(`Informe a matrícula do servidor público para o atleta ${atletaNome}.`);
        }

        const matriculaLimpa = item.matriculaServidor.trim();

        if (categoria.modalidade.evento.vagasServidorPublico !== null) {
          const vagasUtilizadas = await this.prisma.servidorPublico.count({
            where: {
              eventoId: categoria.modalidade.eventoId,
              ...FILTRO_SERVIDOR_EM_USO,
            },
          });
          if (
            vagasUtilizadas + servidoresNoCarrinho >=
            categoria.modalidade.evento.vagasServidorPublico
          ) {
            throw new BadRequestException(
              `As vagas gratuitas para servidores públicos deste evento (${categoria.modalidade.evento.vagasServidorPublico} vagas) já foram esgotadas.`,
            );
          }
        }

        const servidor = await this.prisma.servidorPublico.findFirst({
          where: {
            eventoId: categoria.modalidade.eventoId,
            cpf: atletaCpf,
            matricula: { equals: matriculaLimpa, mode: 'insensitive' },
          },
          include: { inscricao: { select: { status: true } } },
        });

        if (!servidor) {
          throw new NotFoundException(
            `A matrícula "${matriculaLimpa}" com o CPF ${atletaCpf} não foi encontrada na lista oficial de servidores deste evento.`,
          );
        }

        if (servidorEstaEmUso(servidor)) {
          throw new ConflictException(
            `A matrícula "${matriculaLimpa}" do servidor ${atletaNome} já foi utilizada para outra inscrição gratuita neste evento.`,
          );
        }

        isServidorPublico = true;
        matriculaServidor = servidor.matricula;
        servidorPublicoId = servidor.id;
        servidoresNoCarrinho++;
      }

      // Servidor público tem isenção total (100% gratuito); não usufrui do
      // desconto do idoso e não deve ser obrigado a comprovar documento do idoso.
      const documentoIdosoUrl = await this.resolverDocumentoIdoso(
        categoria.modalidade.evento,
        atletaDataNascimento,
        atletaNome,
        item.documentoIdosoUrl,
        !isServidorPublico,
      );

      const evento = categoria.modalidade.evento;
      const querCamisa =
        evento.possuiCamisa && (!evento.camisaOpcional || !!item.incluiCamisa);

      let valor = 0;
      if (isServidorPublico) {
        valor = 0;
      } else {
        valor = await calcularValorInscricao(this.prisma, {
          loteId: lote.id,
          modalidadeId: categoria.modalidadeId,
          clienteId,
          eventoId: lote.eventoId,
          cupomId,
          dataNascimentoAtleta: atletaDataNascimento,
          incluiCamisa: querCamisa,
        });
      }

      inscricoesParaCriar.push({
        categoriaId: item.categoriaId,
        loteId: lote.id,
        cupomId,
        incluiCamisa: querCamisa,
        valorCamisa:
          evento.camisaOpcional && querCamisa && evento.valorCamisaOpcional
            ? evento.valorCamisaOpcional
            : null,
        modeloCamisaId: querCamisa
          ? await this.resolverModeloCamisa(lote.eventoId, item.modeloCamisaId)
          : null,
        tamanhoCamisa: querCamisa ? item.tamanhoCamisa || null : null,
        dependenteId,
        atletaNome,
        atletaCpf,
        atletaDataNascimento,
        atletaGenero,
        atletaPcd,
        documentoIdosoUrl,
        valor,
        isServidorPublico,
        matriculaServidor,
        servidorPublicoId,
      });
    }

    const valorTotal = inscricoesParaCriar.reduce((acc, i) => acc + i.valor, 0);
    const ehTotalmenteGratuito = valorTotal === 0;

    const resultado = await this.prisma.$transaction(async (tx) => {
      const pedido = await tx.pedido.create({
        data: { clienteId },
      });

      const inscricoesCriadas: any[] = [];
      for (const itemData of inscricoesParaCriar) {
        if (itemData.cupomId) {
          await tx.cupom.update({
            where: { id: itemData.cupomId },
            data: { usosAtuais: { increment: 1 } },
          });
        }

        const inscricao = await tx.inscricao.create({
          data: {
            clienteId,
            pedidoId: pedido.id,
            categoriaId: itemData.categoriaId,
            loteId: itemData.loteId,
            cupomId: itemData.cupomId,
            dependenteId: itemData.dependenteId,
            atletaNome: itemData.atletaNome,
            atletaCpf: itemData.atletaCpf,
            atletaDataNascimento: itemData.atletaDataNascimento,
            atletaGenero: itemData.atletaGenero,
            atletaPcd: itemData.atletaPcd,
            incluiCamisa: itemData.incluiCamisa ?? false,
            valorCamisa: itemData.valorCamisa ?? null,
            modeloCamisaId: itemData.modeloCamisaId ?? null,
            tamanhoCamisa: itemData.tamanhoCamisa,
            documentoIdosoUrl: itemData.documentoIdosoUrl,
            documentoIdosoStatus: itemData.documentoIdosoUrl
              ? StatusDocumentoIdoso.PENDENTE
              : null,
            isServidorPublico: itemData.isServidorPublico ?? false,
            matriculaServidor: itemData.matriculaServidor || null,
            status: ehTotalmenteGratuito
              ? StatusInscricao.CONFIRMADA
              : StatusInscricao.PENDENTE_PAGAMENTO,
          },
        });

        // Se era servidor público, amarra o id da inscrição para travar reuso.
        // A condicao de "livre" vai no proprio update: duas compras simultaneas
        // passam pela checagem la de cima, mas so uma consegue amarrar; a outra
        // desfaz o pedido inteiro.
        if (itemData.servidorPublicoId) {
          const { count } = await tx.servidorPublico.updateMany({
            where: { id: itemData.servidorPublicoId, ...FILTRO_SERVIDOR_LIVRE },
            data: {
              inscricaoId: inscricao.id,
              utilizadoEm: new Date(),
            },
          });
          if (count === 0) {
            throw new ConflictException(
              `A matrícula do servidor ${itemData.atletaNome} acabou de ser utilizada em outra inscrição gratuita.`,
            );
          }
        }

        inscricoesCriadas.push({ ...inscricao, valor: itemData.valor });
      }

      // Pedido de R$ 0 (servidores isentos, cupom de 100%...) vira pagamento
      // aprovado zerado. O rotulo so diz "servidor" quando todos do pedido
      // sao servidores; antes um cupom de 100% aparecia como isencao de servidor.
      if (ehTotalmenteGratuito) {
        const todosServidores = inscricoesParaCriar.every((i) => i.isServidorPublico);
        await tx.pagamento.create({
          data: {
            pedidoId: pedido.id,
            valor: 0,
            comissaoPlataforma: 0,
            metodo: MetodoPagamento.PIX,
            status: StatusPagamento.APROVADO,
            gateway: todosServidores ? 'ISENCAO_SERVIDOR_PUBLICO' : 'GRATUITO',
            codigoTransacao: `FREE-${pedido.id.slice(0, 8)}`,
            dataPagamento: new Date(),
          },
        });
      }

      return {
        pedidoId: pedido.id,
        inscricoes: inscricoesCriadas,
        valorTotal,
        status: ehTotalmenteGratuito ? 'CONFIRMADA' : 'PENDENTE_PAGAMENTO',
      };
    });

    if (resultado.status === 'CONFIRMADA') {
      try {
        // Cada atleta pode estar numa modalidade/categoria diferente; antes
        // todos saiam no e-mail com a categoria do primeiro.
        const categorias = await this.prisma.categoria.findMany({
          where: { id: { in: resultado.inscricoes.map((i) => i.categoriaId) } },
          include: { modalidade: { include: { evento: true } } },
        });
        const categoriaPorId = new Map(categorias.map((c) => [c.id, c]));
        const evento = categorias[0]?.modalidade.evento;
        const usuario = await this.prisma.usuario.findUnique({
          where: { id: usuarioId },
          select: { email: true },
        });
        if (evento && usuario?.email) {
          await this.emailService.enviarConfirmacaoInscricaoBatch({
            emailComprador: usuario.email,
            nomeComprador: cliente.pf?.nomeCompleto || 'Atleta',
            nomeEvento: evento.nome,
            dataEvento: new Date(evento.dataInicio).toLocaleDateString('pt-BR'),
            localEvento: evento.local,
            cidadeEstado: `${evento.cidade}/${evento.estado}`,
            valorTotal: '0.00',
            atletas: resultado.inscricoes.map((i: any) => {
              const categoria = categoriaPorId.get(i.categoriaId);
              return {
                inscricaoId: i.id,
                nomeAtleta: i.atletaNome || 'Atleta',
                cpfAtleta: i.atletaCpf || '',
                modalidade: categoria?.modalidade.nome ?? '',
                categoria: categoria?.nome ?? '',
                tamanhoCamisa: i.tamanhoCamisa,
                valor: '0.00',
              };
            }),
          });
        }
      } catch (err: any) {
        // A inscricao ja esta confirmada; falhar o e-mail nao pode derruba-la.
        this.logger.error(
          `Falha ao enviar confirmação do pedido gratuito ${resultado.pedidoId}: ${err?.message ?? err}`,
        );
      }
    }

    return resultado;
  }

  async findMinhas(usuarioId: string) {
    const clienteId = await this.getClienteIdOuFalhar(usuarioId);

    return this.prisma.inscricao.findMany({
      where: { clienteId },
      include: {
        dependente: true,
        pedido: { include: { pagamentos: true } },
        categoria: {
          include: {
            modalidade: {
              include: {
                evento: {
                  include: {
                    modalidades: {
                      include: {
                        categorias: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        lote: true,
        modeloCamisa: true,
        pagamentos: { orderBy: { createdAt: 'desc' } },
        resultado: true,
        certificado: true,
      },
      orderBy: { dataInscricao: 'desc' },
    });
  }

  async cancelar(usuarioId: string, inscricaoId: string) {
    const clienteId = await this.getClienteIdOuFalhar(usuarioId);

    const inscricao = await this.prisma.inscricao.findUnique({
      where: { id: inscricaoId },
    });

    if (!inscricao || inscricao.clienteId !== clienteId) {
      throw new NotFoundException('Inscrição não encontrada.');
    }

    if (inscricao.status !== StatusInscricao.PENDENTE_PAGAMENTO) {
      throw new BadRequestException(
        'Inscrições já pagas não podem ser canceladas. Você pode transferir a titularidade da sua vaga para outro atleta cadastrado na plataforma pelo e-mail.',
      );
    }

  return this.prisma.inscricao.update({
      where: { id: inscricaoId },
      data: { status: StatusInscricao.CANCELADA },
    });
  }

  async atualizarTamanhoCamisa(
    usuarioId: string,
    inscricaoId: string,
    tamanhoCamisa: string,
  ) {
    const clienteId = await this.getClienteIdOuFalhar(usuarioId);

    const inscricao = await this.prisma.inscricao.findUnique({
      where: { id: inscricaoId },
      include: {
        categoria: { include: { modalidade: { include: { evento: true } } } },
      },
    });

    if (!inscricao || inscricao.clienteId !== clienteId) {
      throw new NotFoundException('Inscrição não encontrada.');
    }

    if (inscricao.kitEntregueEm) {
      throw new BadRequestException(
        'O kit já foi retirado e o tamanho da camisa não pode mais ser alterado.',
      );
    }

    const evento = inscricao.categoria.modalidade.evento;

    if (!evento.possuiCamisa) {
      throw new BadRequestException(
        'Este evento não entrega camisa, então não há tamanho para alterar.',
      );
    }

    const agora = new Date();
    if (
      evento.camisasBloqueadas ||
      (evento.limiteTrocaCamisaAté && evento.limiteTrocaCamisaAté < agora)
    ) {
      throw new BadRequestException(
        'As camisetas deste evento já foram enviadas para a gráfica/produção e o tamanho não pode mais ser alterado.',
      );
    }

    return this.prisma.inscricao.update({
      where: { id: inscricaoId },
      data: { tamanhoCamisa },
    });
  }

  async trocarCategoria(
    usuarioId: string,
    inscricaoId: string,
    novaCategoriaId: string,
  ) {
    const cliente = await this.getClienteComPfOuFalhar(usuarioId);
    const clienteId = cliente.id;

    const inscricao = await this.prisma.inscricao.findUnique({
      where: { id: inscricaoId },
      include: {
        categoria: { include: { modalidade: { include: { evento: true } } } },
      },
    });

    if (!inscricao || inscricao.clienteId !== clienteId) {
      throw new NotFoundException('Inscrição não encontrada.');
    }

    if (inscricao.kitEntregueEm) {
      throw new BadRequestException(
        'O kit já foi retirado e a modalidade não pode mais ser alterada.',
      );
    }

    const evento = inscricao.categoria.modalidade.evento;
    const agora = new Date();
    if (
      evento.camisasBloqueadas ||
      (evento.limiteTrocaCamisaAté && evento.limiteTrocaCamisaAté < agora)
    ) {
      throw new BadRequestException(
        'As alterações de modalidade e kit deste evento já foram encerradas pelo organizador para a produção dos kits.',
      );
    }

    const novaCategoria = await this.prisma.categoria.findUnique({
      where: { id: novaCategoriaId },
      include: { modalidade: { include: { evento: true } } },
    });

    if (!novaCategoria) {
      throw new NotFoundException('Nova categoria não encontrada.');
    }

    if (
      novaCategoria.modalidade.eventoId !==
      inscricao.categoria.modalidade.eventoId
    ) {
      throw new BadRequestException(
        'A nova modalidade precisa ser do mesmo evento.',
      );
    }

    this.validarElegibilidadeCategoria(
      novaCategoria,
      cliente.pf,
      novaCategoria.modalidade.evento.dataInicio,
    );

    return this.prisma.inscricao.update({
      where: { id: inscricaoId },
      data: { categoriaId: novaCategoriaId },
    });
  }

  async transferirInscricao(
    usuarioId: string,
    inscricaoId: string,
    emailDestino: string,
  ) {
    const clienteId = await this.getClienteIdOuFalhar(usuarioId);

    const inscricao = await this.prisma.inscricao.findUnique({
      where: { id: inscricaoId },
      include: {
        categoria: { include: { modalidade: { include: { evento: true } } } },
      },
    });

    if (!inscricao || inscricao.clienteId !== clienteId) {
      throw new NotFoundException('Inscrição não encontrada.');
    }

    if (inscricao.status === StatusInscricao.CANCELADA || inscricao.status === StatusInscricao.EXPIRADA) {
      throw new BadRequestException(
        'Inscrições canceladas ou expiradas não podem ser transferidas.',
      );
    }

    if (inscricao.kitEntregueEm) {
      throw new BadRequestException(
        'O kit desta inscrição já foi retirado e ela não pode mais ser transferida.',
      );
    }

    if (!inscricao.categoria.modalidade.evento.permiteTransferencia) {
      throw new BadRequestException(
        'Este evento não permite transferência de titulares.',
      );
    }

    const eventoTransf = inscricao.categoria.modalidade.evento;
    const agoraTransf = new Date();
    if (
      eventoTransf.camisasBloqueadas ||
      (eventoTransf.limiteTrocaCamisaAté && eventoTransf.limiteTrocaCamisaAté < agoraTransf)
    ) {
      throw new BadRequestException(
        'O prazo para transferência de titularidade já foi encerrado, pois os kits deste evento já foram enviados para produção.',
      );
    }

    const usuarioDestino = await this.prisma.usuario.findUnique({
      where: { email: emailDestino.toLowerCase().trim() },
      include: { cliente: true },
    });

    if (!usuarioDestino || !usuarioDestino.cliente) {
      throw new NotFoundException(
        `O atleta com e-mail "${emailDestino}" não possui cadastro na plataforma. Peça para ele criar uma conta primeiro!`,
      );
    }

    if (usuarioDestino.cliente.id === clienteId) {
      throw new BadRequestException('Você não pode transferir a inscrição para você mesmo.');
    }

    return this.prisma.inscricao.update({
      where: { id: inscricaoId },
      data: {
        clienteId: usuarioDestino.cliente.id,
        numeroPeito: null, // reseta o número de peito para reassociação
      },
    });
  }

  // Garante que o atleta realmente se encaixa nas regras da categoria
  // (idade na data do evento, gênero e PCD) antes de deixar a inscrição seguir.
  /**
   * Decide se esta inscricao leva o desconto do idoso e, se leva, exige o
   * documento. A idade vem da data que a propria pessoa digitou, entao sem o
   * documento qualquer um se declarava 60+ e pagava metade. Quem nao se
   * qualifica nao guarda documento nenhum, mesmo que o cliente mande um.
   */
  /**
   * Aceita so modelo ativo do proprio evento. Antes o id ia direto para o
   * banco: um id qualquer dava erro 500 e o de outro evento era gravado.
   */
  private async resolverModeloCamisa(
    eventoId: string,
    modeloCamisaId?: string | null,
  ): Promise<string | null> {
    if (!modeloCamisaId) return null;
    const modelo = await this.prisma.modeloCamisa.findFirst({
      where: { id: modeloCamisaId, eventoId, ativo: true },
      select: { id: true },
    });
    if (!modelo) {
      throw new BadRequestException(
        'O modelo de camisa escolhido não está mais disponível. Volte e escolha outro modelo.',
      );
    }
    return modelo.id;
  }

  private async resolverDocumentoIdoso(
    evento: {
      aplicaDescontoIdoso: boolean;
      percentualDescontoIdoso: unknown;
      dataInicio: Date;
    },
    dataNascimento: Date,
    nomeAtleta: string,
    documentoIdosoUrl?: string,
    exigirDocumento: boolean = true,
  ): Promise<string | null> {
    const temDesconto =
      evento.aplicaDescontoIdoso && Number(evento.percentualDescontoIdoso) > 0;
    if (!temDesconto) return null;
    if (calcularIdade(dataNascimento, evento.dataInicio) < 60) return null;

    const caminho = (documentoIdosoUrl || '').trim();
    if (!exigirDocumento && !caminho) {
      return null;
    }

    // Aceita so o que o proprio upload devolveu: um caminho qualquer viraria
    // link para fora da pasta, e "../" leria arquivo do servidor.
    const prefixo = '/uploads/documentos/';
    const idx = caminho.indexOf(prefixo);
    const caminhoLimpo = idx !== -1 ? caminho.slice(idx) : caminho;

    const nomeArquivo = caminhoLimpo.startsWith(prefixo)
      ? caminhoLimpo.slice(prefixo.length)
      : '';
    const valido =
      nomeArquivo.length > 0 &&
      !nomeArquivo.includes('/') &&
      !nomeArquivo.includes('\\') &&
      !nomeArquivo.includes('..');
    if (!valido) {
      if (!exigirDocumento) return null;
      throw new BadRequestException(
        `${nomeAtleta} tem direito ao desconto do idoso neste evento. Envie um documento com foto (RG ou CNH) para comprovar a idade.`,
      );
    }

    try {
      await access(join(process.cwd(), caminhoLimpo));
    } catch {
      if (!exigirDocumento) return null;
      throw new BadRequestException(
        `O documento enviado para ${nomeAtleta} não foi encontrado. Envie o arquivo novamente.`,
      );
    }

    return caminhoLimpo;
  }

  private validarElegibilidadeCategoria(
    categoria: {
      idadeMinima: number | null;
      idadeMaxima: number | null;
      genero: string;
      pcd: boolean;
    },
    pf: { dataNascimento: Date; genero: string; pcd: boolean } | null,
    dataEvento: Date,
  ) {
    if (!pf) {
      throw new BadRequestException(
        'Complete seu perfil de pessoa física antes de se inscrever.',
      );
    }

    if (categoria.idadeMinima !== null || categoria.idadeMaxima !== null) {
      const idade = calcularIdade(pf.dataNascimento, dataEvento);
      if (categoria.idadeMinima !== null && idade < categoria.idadeMinima) {
        throw new BadRequestException(
          `Essa categoria exige idade mínima de ${categoria.idadeMinima} anos na data do evento.`,
        );
      }
      if (categoria.idadeMaxima !== null && idade > categoria.idadeMaxima) {
        throw new BadRequestException(
          `Essa categoria é só até ${categoria.idadeMaxima} anos na data do evento.`,
        );
      }
    }

    if (categoria.genero !== 'LIVRE' && categoria.genero !== pf.genero) {
      throw new BadRequestException(
        'Essa categoria não corresponde ao gênero informado no seu perfil.',
      );
    }

    if (categoria.pcd && !pf.pcd) {
      throw new BadRequestException(
        'Essa categoria é exclusiva pra pessoas com deficiência (PCD).',
      );
    }
  }

  // Escolhe, entre os lotes do evento com preço definido pra essa modalidade
  // e dentro da própria janela de venda, o mais antigo que ainda tem vaga —
  // isso implementa a "virada automática" quando um lote esgota por quantidade.
  private async resolverLoteDisponivel(eventoId: string, modalidadeId: string) {
    const agora = new Date();

    const lotes = await this.prisma.lote.findMany({
      where: {
        eventoId,
        inicioVenda: { lte: agora },
        fimVenda: { gte: agora },
        precos: { some: { modalidadeId } },
      },
      include: {
        _count: {
          select: {
            inscricoes: {
              where: {
                status: {
                  notIn: [StatusInscricao.CANCELADA, StatusInscricao.EXPIRADA],
                },
              },
            },
          },
        },
      },
      orderBy: { inicioVenda: 'asc' },
    });

    const disponivel = lotes.find(
      (lote) => lote.quantidade === null || lote._count.inscricoes < lote.quantidade,
    );

    if (!disponivel) {
      throw new BadRequestException(
        'Não há vagas disponíveis pra essa modalidade no momento.',
      );
    }

    return disponivel;
  }

  // Mesmo padrão de resolverLoteDisponivel, mas pro limite de vagas da
  // categoria (capacidade null = sem limite).
  private async garantirVagaNaCategoria(categoriaId: string, capacidade: number | null) {
    if (capacidade === null) return;

    const inscritos = await this.prisma.inscricao.count({
      where: {
        categoriaId,
        status: { notIn: [StatusInscricao.CANCELADA, StatusInscricao.EXPIRADA] },
      },
    });

    if (inscritos >= capacidade) {
      throw new BadRequestException(
        'Não há mais vagas disponíveis para essa categoria.',
      );
    }
  }

  // Mesmo padrão, mas pro limite de vagas da modalidade inteira (percurso) —
  // soma todas as categorias dela, já que a maioria das plataformas de
  // corrida controla vaga por percurso/distância, não por categoria.
  private async garantirVagaNaModalidade(modalidadeId: string, capacidade: number | null) {
    if (capacidade === null) return;

    const inscritos = await this.prisma.inscricao.count({
      where: {
        categoria: { modalidadeId },
        status: { notIn: [StatusInscricao.CANCELADA, StatusInscricao.EXPIRADA] },
      },
    });

    if (inscritos >= capacidade) {
      throw new BadRequestException(
        'Não há mais vagas disponíveis para esse percurso.',
      );
    }
  }

  // Mesmo padrão, mas pro limite total de vagas do evento inteiro
  // (evento.capacidade null = sem limite).
  private async garantirVagaNoEvento(eventoId: string, capacidade: number | null) {
    if (capacidade === null) return;

    const inscritos = await this.prisma.inscricao.count({
      where: {
        categoria: { modalidade: { eventoId } },
        status: { notIn: [StatusInscricao.CANCELADA, StatusInscricao.EXPIRADA] },
      },
    });

    if (inscritos >= capacidade) {
      throw new BadRequestException(
        'Não há mais vagas disponíveis para este evento.',
      );
    }
  }

  private async resolverCupomOuFalhar(eventoId: string, codigo: string) {
    const codigoLimpo = codigo.trim();
    if (!codigoLimpo) {
      throw new BadRequestException('Informe o código do cupom.');
    }

    const cupom = await this.prisma.cupom.findFirst({
      where: {
        eventoId,
        codigo: { equals: codigoLimpo, mode: 'insensitive' },
      },
    });

    if (!cupom) {
      throw new BadRequestException(`Cupom "${codigoLimpo}" não foi encontrado para este evento.`);
    }
    if (!cupom.ativo) {
      throw new BadRequestException('Este cupom está inativo no momento.');
    }
    if (cupom.validoAte && cupom.validoAte < new Date()) {
      throw new BadRequestException('Este cupom expirou.');
    }
    const usosEfetivos = await this.prisma.inscricao.count({
      where: {
        cupomId: cupom.id,
        status: {
          notIn: [StatusInscricao.CANCELADA, StatusInscricao.EXPIRADA],
        },
      },
    });

    if (
      cupom.quantidadeMaxima !== null &&
      usosEfetivos >= cupom.quantidadeMaxima
    ) {
      throw new BadRequestException('Este cupom já atingiu o limite máximo de usos.');
    }

    return cupom.id;
  }

  private async getClienteComPfOuFalhar(usuarioId: string) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { usuarioId },
      include: { pf: true },
    });
    if (!cliente) {
      throw new NotFoundException(
        'Complete seu perfil (PF ou PJ) antes de se inscrever em um evento.',
      );
    }
    return cliente;
  }

  private async getClienteIdOuFalhar(usuarioId: string): Promise<string> {
    const cliente = await this.prisma.cliente.findUnique({
      where: { usuarioId },
    });
    if (!cliente) {
      throw new NotFoundException(
        'Complete seu perfil (PF ou PJ) antes de se inscrever em um evento.',
      );
    }
    return cliente.id;
  }
}
