import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizadorService } from '../organizador/organizador.service';
import { AuditLogService } from '../audit-log/audit-log.service';

describe('AdminService.alterarCpfUsuario', () => {
  let service: AdminService;
  let prisma: any;
  let tx: any;
  let auditLog: { log: jest.Mock };

  const CPF_ANTIGO = '11144477735';
  const CPF_NOVO = '52998224725';

  function usuarioAtleta(extra: Record<string, unknown> = {}) {
    return {
      id: 'usuario-1',
      email: 'atleta@exemplo.com',
      cliente: {
        id: 'cliente-1',
        pf: { cpf: CPF_ANTIGO, nomeCompleto: 'Atleta Teste' },
        organizador: null,
        ...extra,
      },
    };
  }

  beforeEach(async () => {
    tx = {
      clientePf: { update: jest.fn().mockResolvedValue({}) },
      inscricao: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };
    prisma = {
      usuario: { findUnique: jest.fn().mockResolvedValue(usuarioAtleta()) },
      clientePf: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((fn: any) => fn(tx)),
    };
    auditLog = { log: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: prisma },
        { provide: OrganizadorService, useValue: {} },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = moduleRef.get(AdminService);
  });

  it('troca o CPF do cadastro e das inscricoes do proprio atleta', async () => {
    const res = await service.alterarCpfUsuario('admin-1', 'usuario-1', CPF_NOVO);

    expect(tx.clientePf.update).toHaveBeenCalledWith({
      where: { clienteId: 'cliente-1' },
      data: { cpf: CPF_NOVO },
    });
    // So as inscricoes dele: sem dependente e com o CPF antigo dele.
    expect(tx.inscricao.updateMany).toHaveBeenCalledWith({
      where: { clienteId: 'cliente-1', dependenteId: null, atletaCpf: CPF_ANTIGO },
      data: { atletaCpf: CPF_NOVO },
    });
    expect(res).toEqual({ cpf: CPF_NOVO, inscricoesAtualizadas: 2 });
    expect(auditLog.log).toHaveBeenCalledWith(
      expect.objectContaining({
        detalhes: expect.objectContaining({ cpfAnterior: CPF_ANTIGO, cpfNovo: CPF_NOVO, adminId: 'admin-1' }),
      }),
    );
  });

  it('recusa CPF que ja e de outra conta', async () => {
    prisma.clientePf.findUnique.mockResolvedValue({ id: 'outro' });

    await expect(
      service.alterarCpfUsuario('admin-1', 'usuario-1', CPF_NOVO),
    ).rejects.toThrow(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('recusa conta de organizador (CPF define a conta de saque)', async () => {
    prisma.usuario.findUnique.mockResolvedValue(usuarioAtleta({ organizador: { id: 'org-1' } }));

    await expect(
      service.alterarCpfUsuario('admin-1', 'usuario-1', CPF_NOVO),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('mesmo CPF nao altera nada', async () => {
    const res = await service.alterarCpfUsuario('admin-1', 'usuario-1', CPF_ANTIGO);

    expect(res.inscricoesAtualizadas).toBe(0);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(auditLog.log).not.toHaveBeenCalled();
  });
});

describe('AdminService.bloquearCupom', () => {
  let service: AdminService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      evento: {
        findUnique: jest.fn().mockResolvedValue({ id: 'evento-1' }),
      },
      cupom: {
        findUnique: jest.fn().mockResolvedValue({ id: 'cupom-1', eventoId: 'evento-1', ativo: true }),
        update: jest.fn().mockResolvedValue({}),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: prisma },
        { provide: OrganizadorService, useValue: {} },
        { provide: AuditLogService, useValue: { log: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(AdminService);
  });

  it('bloquear desativa o cupom', async () => {
    await service.bloquearCupom('evento-1', 'cupom-1', true);

    expect(prisma.cupom.update).toHaveBeenCalledWith({
      where: { id: 'cupom-1' },
      data: { ativo: false },
    });
  });

  it('desbloquear reativa o cupom', async () => {
    await service.bloquearCupom('evento-1', 'cupom-1', false);

    expect(prisma.cupom.update).toHaveBeenCalledWith({
      where: { id: 'cupom-1' },
      data: { ativo: true },
    });
  });

  it('recusa cupom de outro evento', async () => {
    prisma.cupom.findUnique.mockResolvedValue({ id: 'cupom-1', eventoId: 'outro', ativo: true });

    await expect(service.bloquearCupom('evento-1', 'cupom-1', true)).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.cupom.update).not.toHaveBeenCalled();
  });
});

describe('AdminService.configurarFuncionarios', () => {
  let service: AdminService;
  let prisma: any;

  const eventoBase = {
    id: 'evento-1',
    permiteFuncionarios: false,
    percentualFuncionarios: null as string | null,
  };

  beforeEach(async () => {
    prisma = {
      evento: {
        findUnique: jest.fn().mockResolvedValue(eventoBase),
        update: jest.fn().mockImplementation(({ data }: any) => ({ id: 'evento-1', ...data })),
      },
      funcionarioEmpresa: { count: jest.fn().mockResolvedValue(0) },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: prisma },
        { provide: OrganizadorService, useValue: {} },
        { provide: AuditLogService, useValue: { log: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(AdminService);
  });

  it('libera com percentual, vagas e nome da empresa', async () => {
    const res = await service.configurarFuncionarios('evento-1', {
      liberado: true,
      percentual: 50,
      vagas: 100,
      nomeEmpresa: '  Dakota  ',
    });

    expect(prisma.evento.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          permiteFuncionarios: true,
          percentualFuncionarios: 50,
          vagasFuncionarios: 100,
          nomeEmpresaFuncionarios: 'Dakota',
        },
      }),
    );
    expect(res.resumoFuncionarios).toEqual({ naLista: 0, inscritos: 0, percentualTravado: false });
  });

  it('nao libera sem percentual', async () => {
    await expect(
      service.configurarFuncionarios('evento-1', { liberado: true }),
    ).rejects.toThrow('Informe o percentual');
    expect(prisma.evento.update).not.toHaveBeenCalled();
  });

  it('percentual trava depois da primeira inscricao', async () => {
    prisma.evento.findUnique.mockResolvedValue({
      ...eventoBase,
      permiteFuncionarios: true,
      percentualFuncionarios: '50',
    });
    prisma.funcionarioEmpresa.count.mockResolvedValue(1);

    await expect(
      service.configurarFuncionarios('evento-1', { liberado: true, percentual: 30 }),
    ).rejects.toThrow(/travado em 50%/);
    expect(prisma.evento.update).not.toHaveBeenCalled();
  });

  it('com percentual travado, ainda pode desligar e reenviar o mesmo percentual', async () => {
    prisma.evento.findUnique.mockResolvedValue({
      ...eventoBase,
      permiteFuncionarios: true,
      percentualFuncionarios: '50',
    });
    prisma.funcionarioEmpresa.count.mockResolvedValue(3);

    await service.configurarFuncionarios('evento-1', { liberado: false, percentual: 50 });

    expect(prisma.evento.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ permiteFuncionarios: false }),
      }),
    );
  });

  it('vagas vazias viram sem limite', async () => {
    prisma.evento.findUnique.mockResolvedValue({ ...eventoBase, percentualFuncionarios: '40' });

    await service.configurarFuncionarios('evento-1', { liberado: true, vagas: null });

    expect(prisma.evento.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ vagasFuncionarios: null }),
      }),
    );
  });
});
