import { BadRequestException, ConflictException } from '@nestjs/common';
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
