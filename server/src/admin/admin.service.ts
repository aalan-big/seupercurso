import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { OrganizadorService } from '../organizador/organizador.service';
import { Prisma } from '../generated/prisma/client';
import {
  CategoriaAuditLog,
  NivelAuditLog,
  StatusEvento,
  StatusInscricao,
  StatusOrganizador,
  StatusPagamento,
} from '../generated/prisma/enums';
import { CriarUsuarioAdminDto } from './dto/criar-usuario.dto';
import { CriarAdminDto } from './dto/criar-admin.dto';

import { montarSerieDiaria } from '../common/montar-serie-diaria';

const ORGANIZADOR_INCLUDE = {
  cliente: {
    include: {
      usuario: { select: { email: true } },
      pf: true,
      pj: true,
      enderecos: true,
    },
  },
} as const;

const EVENTO_INCLUDE = {
  organizador: { include: ORGANIZADOR_INCLUDE },
  modalidades: { include: { categorias: true } },
} as const;

// Sem 0/O, 1/l/I: a senha e lida na tela e repassada ao atleta por telefone.
const ALFABETO_SENHA = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function gerarSenhaAleatoria(tamanho = 10): string {
  let senha = '';
  for (let i = 0; i < tamanho; i++) {
    senha += ALFABETO_SENHA[randomInt(ALFABETO_SENHA.length)];
  }
  return senha;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizadorService: OrganizadorService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async listarOrganizadores(status?: string) {
    const whereClause: Prisma.OrganizadorWhereInput = status
      ? {
          status: status as StatusOrganizador,
          ...(status === StatusOrganizador.PENDENTE
            ? {
                fotoRostoUrl: { not: null },
                documentoIdentidadeUrl: { not: null },
              }
            : {}),
        }
      : {};

    return this.prisma.organizador.findMany({
      where: whereClause,
      orderBy: { createdAt: 'asc' },
      include: ORGANIZADOR_INCLUDE,
    });
  }


  async buscarOrganizador(id: string) {
    const organizador = await this.prisma.organizador.findUnique({
      where: { id },
      include: ORGANIZADOR_INCLUDE,
    });
    if (!organizador) {
      throw new NotFoundException('Organizador não encontrado.');
    }
    return organizador;
  }

  async aprovarOrganizador(id: string) {
    const organizador = await this.getOrganizadorOuFalhar(id);

    await this.prisma.organizador.update({
      where: { id },
      data: { status: StatusOrganizador.APROVADO, motivoRevisao: null },
    });


    return this.prisma.organizador.findUnique({
      where: { id },
      include: ORGANIZADOR_INCLUDE,
    });
  }

  async rejeitarOrganizador(id: string, motivo?: string) {
    await this.getOrganizadorOuFalhar(id);

    return this.prisma.organizador.update({
      where: { id },
      data: { status: StatusOrganizador.REJEITADO, motivoRevisao: motivo ?? null },
      include: ORGANIZADOR_INCLUDE,
    });
  }

  async suspenderOrganizador(id: string, motivo?: string) {
    const organizador = await this.getOrganizadorOuFalhar(id);

    if (organizador.status !== StatusOrganizador.APROVADO) {
      throw new BadRequestException(
        'Só é possível suspender um organizador que já está aprovado.',
      );
    }

    return this.prisma.organizador.update({
      where: { id },
      data: { status: StatusOrganizador.SUSPENSO, motivoRevisao: motivo ?? null },
      include: ORGANIZADOR_INCLUDE,
    });
  }

  async atualizarComissaoOrganizador(id: string, comissaoPercentual: number) {
    await this.getOrganizadorOuFalhar(id);

    return this.prisma.organizador.update({
      where: { id },
      data: { comissaoPercentual },
      include: ORGANIZADOR_INCLUDE,
    });
  }

  async listarEventos(status?: string) {
    return this.prisma.evento.findMany({
      where: status ? { status: status as StatusEvento } : undefined,
      orderBy: { createdAt: 'asc' },
      include: EVENTO_INCLUDE,
    });
  }

  async buscarEvento(id: string) {
    const evento = await this.prisma.evento.findUnique({
      where: { id },
      include: EVENTO_INCLUDE,
    });
    if (!evento) {
      throw new NotFoundException('Evento não encontrado.');
    }
    return evento;
  }

  async aprovarEvento(id: string) {
    const evento = await this.getEventoOuFalhar(id);

    const organizador = await this.prisma.organizador.findUnique({
      where: { id: evento.organizadorId },
    });

    if (!organizador?.mpUserId) {
      throw new BadRequestException(
        'Este organizador ainda não conectou a conta do Mercado Pago. O evento não pode ser publicado sem conta de recebimento conectada.',
      );
    }

    return this.prisma.evento.update({
      where: { id },
      data: { status: StatusEvento.PUBLICADO, motivoRejeicao: null },
      include: EVENTO_INCLUDE,
    });
  }

  async rejeitarEvento(id: string, motivo?: string) {
    await this.getEventoOuFalhar(id);

    return this.prisma.evento.update({
      where: { id },
      data: { status: StatusEvento.RASCUNHO, motivoRejeicao: motivo ?? null },
      include: EVENTO_INCLUDE,
    });
  }

  async suspenderEvento(id: string, motivo?: string) {
    await this.getEventoOuFalhar(id);

    return this.prisma.evento.update({
      where: { id },
      data: { status: StatusEvento.SUSPENSO, motivoRejeicao: motivo ?? 'Evento suspenso/barrado pela administração master da plataforma.' },
      include: EVENTO_INCLUDE,
    });
  }

  async configurarServidorPublico(id: string, liberado: boolean, vagas?: number | null) {
    await this.getEventoOuFalhar(id);

    return this.prisma.evento.update({
      where: { id },
      data: {
        permiteServidorPublico: liberado,
        vagasServidorPublico: vagas ?? null,
      },
      include: EVENTO_INCLUDE,
    });
  }

  async obterDashboard() {
    const DIAS_SERIE = 14;
    const desde = new Date();
    desde.setUTCHours(0, 0, 0, 0);
    desde.setUTCDate(desde.getUTCDate() - (DIAS_SERIE - 1));

    const [
      organizadoresPendentes,
      eventosAguardandoAprovacao,
      organizadoresAprovados,
      eventosPublicados,
      inscricoesConfirmadas,
      organizadoresRecentes,
      eventosRecentes,
      organizadoresPorStatusRaw,
      eventosPorStatusRaw,
      inscricoesRecentes,
    ] = await Promise.all([
      this.prisma.organizador.count({
        where: {
          status: StatusOrganizador.PENDENTE,
          fotoRostoUrl: { not: null },
          documentoIdentidadeUrl: { not: null },
        },
      }),
      this.prisma.evento.count({
        where: { status: StatusEvento.AGUARDANDO_APROVACAO },
      }),
      this.prisma.organizador.count({
        where: { status: StatusOrganizador.APROVADO },
      }),
      this.prisma.evento.count({ where: { status: StatusEvento.PUBLICADO } }),
      this.prisma.inscricao.count({
        where: { status: StatusInscricao.CONFIRMADA },
      }),
      this.prisma.organizador.findMany({
        where: {
          status: StatusOrganizador.PENDENTE,
          fotoRostoUrl: { not: null },
          documentoIdentidadeUrl: { not: null },
        },
        orderBy: { createdAt: 'asc' },
        take: 5,
        include: ORGANIZADOR_INCLUDE,
      }),

      this.prisma.evento.findMany({
        where: { status: StatusEvento.AGUARDANDO_APROVACAO },
        orderBy: { createdAt: 'asc' },
        take: 5,
        include: EVENTO_INCLUDE,
      }),
      this.prisma.organizador.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.evento.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.inscricao.findMany({
        where: {
          status: StatusInscricao.CONFIRMADA,
          dataInscricao: { gte: desde },
        },
        select: { dataInscricao: true },
      }),
    ]);

    const organizadoresPorStatus = Object.fromEntries(
      organizadoresPorStatusRaw.map((linha) => [linha.status, linha._count._all]),
    );
    const eventosPorStatus = Object.fromEntries(
      eventosPorStatusRaw.map((linha) => [linha.status, linha._count._all]),
    );
    const inscricoesPorDia = montarSerieDiaria(
      inscricoesRecentes.map((i) => i.dataInscricao),
      DIAS_SERIE,
    );

    return {
      contadores: {
        organizadoresPendentes,
        eventosAguardandoAprovacao,
        organizadoresAprovados,
        eventosPublicados,
        inscricoesConfirmadas,
      },
      organizadoresPorStatus,
      eventosPorStatus,
      inscricoesPorDia,
      organizadoresRecentes,
      eventosRecentes,
    };
  }

  async obterFinanceiro() {
    // O checkout agrupa inscrições em um Pedido; sem carregar `pedido.inscricoes`
    // essas vendas caíam no `if (!evento) continue` e sumiam do relatório.
    const eventoSelect = {
      categoria: {
        select: {
          modalidade: {
            select: {
              evento: {
                select: {
                  id: true,
                  nome: true,
                  organizador: {
                    select: {
                      id: true,
                      comissaoPercentual: true,
                      cliente: {
                        select: {
                          usuario: { select: { email: true } },
                          pf: { select: { nomeCompleto: true } },
                          pj: { select: { razaoSocial: true } },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    } as const;

    const pagamentos = await this.prisma.pagamento.findMany({
      where: { status: StatusPagamento.APROVADO },
      select: {
        valor: true,
        taxaGateway: true,
        comissaoPlataforma: true,
        inscricao: { select: eventoSelect },
        pedido: {
          select: {
            inscricoes: { take: 1, select: eventoSelect },
          },
        },
      },
    });

    interface ResumoValores {
      quantidadePagamentos: number;
      totalArrecadado: number;
      comissaoPlataforma: number;
    }

    interface ResumoEvento extends ResumoValores {
      eventoId: string;
      nome: string;
    }

    interface ResumoOrganizador extends ResumoValores {
      organizadorId: string;
      nome: string;
      eventos: Map<string, ResumoEvento>;
    }

    const porOrganizador = new Map<string, ResumoOrganizador>();
    let totalArrecadado = 0;
    let comissaoPlataforma = 0;

    for (const pagamento of pagamentos) {
      const valor = Number(pagamento.valor);
      const evento = (pagamento.inscricao as any)?.categoria?.modalidade?.evento || (pagamento as any).pedido?.inscricoes?.[0]?.categoria?.modalidade?.evento;
      if (!evento) continue;
      const organizador = evento.organizador;
      if (!organizador) continue;
      const percentual = Number(organizador.comissaoPercentual);
      // A comissao retida vem gravada na propria cobranca. O calculo abaixo so
      // atende linha antiga que o backfill nao alcancou: aplicar o percentual
      // sobre o valor cobrado inflaria a conta, porque ele ja embute a comissao
      // e a tarifa do gateway.
      const comissao =
        pagamento.comissaoPlataforma !== null &&
        pagamento.comissaoPlataforma !== undefined
          ? Number(pagamento.comissaoPlataforma)
          : Math.max(0, valor - Number(pagamento.taxaGateway ?? 0)) *
            (percentual / 100);

      totalArrecadado += valor;
      comissaoPlataforma += comissao;

      const nomeOrganizador =
        organizador.cliente.pf?.nomeCompleto ||
        organizador.cliente.pj?.razaoSocial ||
        organizador.cliente.usuario.email;

      const resumoOrganizador = porOrganizador.get(organizador.id) ?? {
        organizadorId: organizador.id,
        nome: nomeOrganizador,
        quantidadePagamentos: 0,
        totalArrecadado: 0,
        comissaoPlataforma: 0,
        eventos: new Map<string, ResumoEvento>(),
      };
      resumoOrganizador.quantidadePagamentos += 1;
      resumoOrganizador.totalArrecadado += valor;
      resumoOrganizador.comissaoPlataforma += comissao;

      const resumoEvento = resumoOrganizador.eventos.get(evento.id) ?? {
        eventoId: evento.id,
        nome: evento.nome,
        quantidadePagamentos: 0,
        totalArrecadado: 0,
        comissaoPlataforma: 0,
      };
      resumoEvento.quantidadePagamentos += 1;
      resumoEvento.totalArrecadado += valor;
      resumoEvento.comissaoPlataforma += comissao;
      resumoOrganizador.eventos.set(evento.id, resumoEvento);

      porOrganizador.set(organizador.id, resumoOrganizador);
    }

    return {
      totalArrecadado,
      comissaoPlataforma,
      totalRepasse: totalArrecadado - comissaoPlataforma,
      porOrganizador: Array.from(porOrganizador.values()).map((o) => ({
        organizadorId: o.organizadorId,
        nome: o.nome,
        quantidadePagamentos: o.quantidadePagamentos,
        totalArrecadado: o.totalArrecadado,
        comissaoPlataforma: o.comissaoPlataforma,
        repasse: o.totalArrecadado - o.comissaoPlataforma,
        eventos: Array.from(o.eventos.values()).map((e) => ({
          ...e,
          repasse: e.totalArrecadado - e.comissaoPlataforma,
        })),
      })),
    };
  }

  private async getOrganizadorOuFalhar(id: string) {
    const organizador = await this.prisma.organizador.findUnique({
      where: { id },
    });
    if (!organizador) {
      throw new NotFoundException('Organizador não encontrado.');
    }
    return organizador;
  }

  private async getEventoOuFalhar(id: string) {
    const evento = await this.prisma.evento.findUnique({ where: { id } });
    if (!evento) {
      throw new NotFoundException('Evento não encontrado.');
    }
    return evento;
  }

  async buscarUsuarios(busca?: string) {
    const termo = busca?.trim();
    const where: Prisma.UsuarioWhereInput = termo
      ? {
          OR: [
            { email: { contains: termo, mode: 'insensitive' } },
            {
              cliente: {
                pf: {
                  OR: [
                    { nomeCompleto: { contains: termo, mode: 'insensitive' } },
                    { cpf: { contains: termo.replace(/\D/g, '') || termo } },
                    { celular: { contains: termo } },
                  ],
                },
              },
            },
            {
              cliente: {
                pj: {
                  OR: [
                    { razaoSocial: { contains: termo, mode: 'insensitive' } },
                    { cnpj: { contains: termo.replace(/\D/g, '') || termo } },
                  ],
                },
              },
            },
          ],
        }
      : {};

    return this.prisma.usuario.findMany({
      where,
      take: 50,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        emailVerificado: true,
        status: true,
        createdAt: true,
        cliente: {
          select: {
            id: true,
            pf: {
              select: {
                nomeCompleto: true,
                cpf: true,
                celular: true,
              },
            },
            pj: {
              select: {
                razaoSocial: true,
                cnpj: true,
                celularComercial: true,
              },
            },
            // A tela esconde "Corrigir CPF" de organizador: o CPF dele define
            // a conta de saque e muda pelo fluxo com foto do documento.
            organizador: { select: { id: true } },
            _count: {
              select: {
                inscricoes: true,
              },
            },
            inscricoes: {
              take: 5,
              orderBy: { dataInscricao: 'desc' },
              select: {
                id: true,
                status: true,
                categoria: {
                  select: {
                    nome: true,
                    modalidade: {
                      select: {
                        evento: {
                          select: {
                            nome: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async verificarEmailUsuario(id: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
    });
    if (!usuario) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    return this.prisma.usuario.update({
      where: { id },
      data: {
        emailVerificado: true,
      },
      select: {
        id: true,
        email: true,
        emailVerificado: true,
      },
    });
  }

  /**
   * Corrige o CPF de um atleta (erro de digitacao no cadastro). Junto troca a
   * copia do CPF gravada nas inscricoes dele mesmo: e ela que sai na planilha
   * do organizador, na busca de inscritos e no voucher. Inscricoes de
   * dependentes e as recebidas por transferencia tem outro CPF e ficam como
   * estao.
   */
  async alterarCpfUsuario(adminId: string, id: string, cpfNovo: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        cliente: {
          select: {
            id: true,
            pf: { select: { cpf: true, nomeCompleto: true } },
            organizador: { select: { id: true } },
          },
        },
      },
    });
    if (!usuario) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const cliente = usuario.cliente;
    if (!cliente?.pf) {
      throw new BadRequestException(
        'Esta conta não tem cadastro de pessoa física para corrigir o CPF.',
      );
    }
    if (cliente.organizador) {
      throw new BadRequestException(
        'Esta conta é de organizador: o CPF define a conta de recebimento. Use a tela "Alteração de CPF/CNPJ", que confere a foto do documento.',
      );
    }

    const cpfAnterior = cliente.pf.cpf;
    if (cpfAnterior === cpfNovo) {
      return { cpf: cpfNovo, inscricoesAtualizadas: 0 };
    }

    const jaExiste = await this.prisma.clientePf.findUnique({
      where: { cpf: cpfNovo },
      select: { id: true },
    });
    if (jaExiste) {
      throw new ConflictException('Este CPF já está cadastrado em outra conta.');
    }

    const inscricoesAtualizadas = await this.prisma.$transaction(async (tx) => {
      await tx.clientePf.update({
        where: { clienteId: cliente.id },
        data: { cpf: cpfNovo },
      });
      const { count } = await tx.inscricao.updateMany({
        where: { clienteId: cliente.id, dependenteId: null, atletaCpf: cpfAnterior },
        data: { atletaCpf: cpfNovo },
      });
      return count;
    });

    this.auditLogService.log({
      categoria: CategoriaAuditLog.SEGURANCA,
      nivel: NivelAuditLog.WARN,
      mensagem: `CPF de ${cliente.pf.nomeCompleto} corrigido pelo admin`,
      detalhes: {
        usuarioId: usuario.id,
        email: usuario.email,
        cpfAnterior,
        cpfNovo,
        inscricoesAtualizadas,
        adminId,
      },
    });

    return { cpf: cpfNovo, inscricoesAtualizadas };
  }

  async alterarEmailUsuario(id: string, novoEmail: string) {
    const emailNormalizado = novoEmail.trim().toLowerCase();
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
    });
    if (!usuario) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    if (usuario.email.toLowerCase() === emailNormalizado) {
      return this.prisma.usuario.update({
        where: { id },
        data: { emailVerificado: true },
        select: { id: true, email: true, emailVerificado: true },
      });
    }

    const jaExiste = await this.prisma.usuario.findUnique({
      where: { email: emailNormalizado },
    });
    if (jaExiste) {
      throw new ConflictException('Já existe outro usuário cadastrado com este e-mail.');
    }

    return this.prisma.usuario.update({
      where: { id },
      data: {
        email: emailNormalizado,
        emailVerificado: true,
      },
      select: {
        id: true,
        email: true,
        emailVerificado: true,
      },
    });
  }

  async criarUsuario(dto: CriarUsuarioAdminDto) {
    const emailNormalizado = dto.email.trim().toLowerCase();
    const cpfLimpo = dto.cpf.replace(/\D/g, '');

    const existeEmail = await this.prisma.usuario.findUnique({
      where: { email: emailNormalizado },
    });
    if (existeEmail) {
      throw new ConflictException('Já existe uma conta com esse e-mail.');
    }

    const existeCpf = await this.prisma.clientePf.findUnique({
      where: { cpf: cpfLimpo },
    });
    if (existeCpf) {
      throw new ConflictException('Já existe um atleta cadastrado com esse CPF.');
    }

    // Sem senha informada, gera uma aleatoria. A antiga ("sp" + 6 digitos do
    // CPF) era adivinhavel por quem soubesse o CPF do atleta.
    const senha = dto.password?.trim() || gerarSenhaAleatoria();
    const passwordHash = await bcrypt.hash(senha, 10);

    const dataNasc = new Date(dto.dataNascimento);

    const usuario = await this.prisma.usuario.create({
      data: {
        email: emailNormalizado,
        passwordHash,
        emailVerificado: true,
        cliente: {
          create: {
            pf: {
              create: {
                nomeCompleto: dto.nomeCompleto.trim(),
                cpf: cpfLimpo,
                dataNascimento: dataNasc,
                genero: dto.genero,
                celular: dto.celular?.trim() || '',
                nacionalidade: 'Brasileira',
              },
            },
          },
        },
      },
      select: {
        id: true,
        email: true,
        emailVerificado: true,
        status: true,
        createdAt: true,
        cliente: {
          select: {
            id: true,
            pf: {
              select: {
                nomeCompleto: true,
                cpf: true,
                celular: true,
              },
            },
            _count: {
              select: {
                inscricoes: true,
              },
            },
            inscricoes: {
              take: 5,
              select: {
                id: true,
                status: true,
                categoria: {
                  select: {
                    nome: true,
                    modalidade: {
                      select: {
                        evento: {
                          select: {
                            nome: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    return {
      usuario,
      senhaDefinida: senha,
    };
  }

  async listarAdministradores() {
    return this.prisma.admin.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        nome: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async criarAdministrador(dto: CriarAdminDto) {
    const emailNormalizado = dto.email.trim().toLowerCase();

    const existe = await this.prisma.admin.findUnique({
      where: { email: emailNormalizado },
    });
    if (existe) {
      throw new ConflictException('Já existe um administrador cadastrado com esse e-mail.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.admin.create({
      data: {
        nome: dto.nome.trim(),
        email: emailNormalizado,
        passwordHash,
      },
      select: {
        id: true,
        nome: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}
