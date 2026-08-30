import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StatusInscricao } from '../generated/prisma/enums';
import { calcularValorInscricao } from '../common/calcular-valor-inscricao';
import { calcularIdade } from '../common/calcular-idade';
import { CreateInscricaoDto } from './dto/create-inscricao.dto';
import { CreateInscricaoBatchDto } from './dto/create-inscricao-batch.dto';

@Injectable()
export class InscricaoService {
  constructor(private readonly prisma: PrismaService) {}

  async create(usuarioId: string, dto: CreateInscricaoDto) {
    await this.garantirEmailVerificado(usuarioId);
    const cliente = await this.getClienteComPfOuFalhar(usuarioId);
    const clienteId = cliente.id;

    const categoria = await this.prisma.categoria.findUnique({
      where: { id: dto.categoriaId },
      include: { modalidade: { include: { evento: true } } },
    });
    if (!categoria) {
      throw new NotFoundException('Categoria não encontrada.');
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

    const valor = await calcularValorInscricao(this.prisma, {
      loteId: lote.id,
      modalidadeId: categoria.modalidadeId,
      clienteId,
      eventoId: lote.eventoId,
      cupomId,
    });

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
          tamanhoCamisa: dto.tamanhoCamisa,
          status: StatusInscricao.PENDENTE_PAGAMENTO,
        },
      });
    });

    return { ...inscricao, valor };
  }

  async createBatch(usuarioId: string, dto: CreateInscricaoBatchDto) {
    await this.garantirEmailVerificado(usuarioId);
    const cliente = await this.getClienteComPfOuFalhar(usuarioId);
    const clienteId = cliente.id;

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Selecione ao menos um participante para a inscrição.');
    }

    const inscricoesParaCriar: Array<{
      categoriaId: string;
      loteId: string;
      cupomId: string | null;
      tamanhoCamisa: string | null;
      dependenteId: string | null;
      atletaNome: string;
      atletaCpf: string;
      atletaDataNascimento: Date;
      atletaGenero: any;
      atletaPcd: boolean;
      valor: number;
    }> = [];

    const cpfsNoCarrinho = new Set<string>();

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

      const valor = await calcularValorInscricao(this.prisma, {
        loteId: lote.id,
        modalidadeId: categoria.modalidadeId,
        clienteId,
        eventoId: lote.eventoId,
        cupomId,
        dataNascimentoAtleta: atletaDataNascimento,
      });

      inscricoesParaCriar.push({
        categoriaId: item.categoriaId,
        loteId: lote.id,
        cupomId,
        tamanhoCamisa: item.tamanhoCamisa || null,
        dependenteId,
        atletaNome,
        atletaCpf,
        atletaDataNascimento,
        atletaGenero,
        atletaPcd,
        valor,
      });
    }

    const valorTotal = inscricoesParaCriar.reduce((acc, i) => acc + i.valor, 0);

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
            tamanhoCamisa: itemData.tamanhoCamisa,
            status: StatusInscricao.PENDENTE_PAGAMENTO,
          },
        });

        inscricoesCriadas.push({ ...inscricao, valor: itemData.valor });
      }

      return { pedidoId: pedido.id, inscricoes: inscricoesCriadas, valorTotal };
    });

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

  private async garantirEmailVerificado(usuarioId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { emailVerificado: true },
    });
    if (!usuario?.emailVerificado) {
      throw new ForbiddenException(
        'Confirme seu e-mail antes de se inscrever em um evento. Verifique sua caixa de entrada.',
      );
    }
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
