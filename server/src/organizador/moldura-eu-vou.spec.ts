import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { writeFile, unlink } from 'fs/promises';
import { validarMolduraEuVou } from './moldura-eu-vou';
import { OrganizadorService } from './organizador.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { MercadoPagoOAuthService } from '../pagamento/mercadopago/mercadopago-oauth.service';
import { EmailService } from '../email/email.service';
import { StatusOrganizador } from '../generated/prisma/enums';

jest.mock('fs/promises', () => ({
  ...jest.requireActual('fs/promises'),
  writeFile: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
}));

/** PNG mínimo (assinatura + chunks); o validador só lê o cabeçalho, sem CRC. */
function png(largura: number, altura: number, tipoCor: number, chunksExtras: string[] = []): Buffer {
  const chunk = (tipo: string, dados: Buffer) => {
    const tamanho = Buffer.alloc(4);
    tamanho.writeUInt32BE(dados.length);
    return Buffer.concat([tamanho, Buffer.from(tipo, 'ascii'), dados, Buffer.alloc(4)]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largura, 0);
  ihdr.writeUInt32BE(altura, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(tipoCor, 9);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    ...chunksExtras.map((t) => chunk(t, Buffer.alloc(3))),
    chunk('IDAT', Buffer.alloc(10)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

describe('validarMolduraEuVou', () => {
  it('aceita PNG 1080×1350 com canal alfa (RGBA)', () => {
    expect(validarMolduraEuVou(png(1080, 1350, 6))).toEqual({ largura: 1080, altura: 1350 });
  });

  it('aceita PNG com paleta e transparência (tRNS)', () => {
    expect(() => validarMolduraEuVou(png(1080, 1350, 3, ['PLTE', 'tRNS']))).not.toThrow();
  });

  it('recusa PNG sem transparência', () => {
    expect(() => validarMolduraEuVou(png(1080, 1350, 2))).toThrow(/transparência/);
    expect(() => validarMolduraEuVou(png(1080, 1350, 3, ['PLTE']))).toThrow(/transparência/);
  });

  it('aceita o formato story 1080×1920', () => {
    expect(validarMolduraEuVou(png(1080, 1920, 6))).toEqual({ largura: 1080, altura: 1920 });
  });

  it('recusa formato fora de story/feed (quadrado, capa 3:4, horizontal)', () => {
    for (const [l, a] of [[1080, 1080], [1200, 1600], [1920, 1080]]) {
      expect(() => validarMolduraEuVou(png(l, a, 6))).toThrow(/story/);
    }
  });

  it('recusa pequena ou grande demais', () => {
    expect(() => validarMolduraEuVou(png(450, 800, 6))).toThrow(/largura/);
    expect(() => validarMolduraEuVou(png(4500, 8000, 6))).toThrow(/largura/);
  });

  it('recusa arquivo que não é PNG (JPG renomeado)', () => {
    const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(60)]);
    expect(() => validarMolduraEuVou(jpg)).toThrow(BadRequestException);
  });
});

describe('OrganizadorService — moldura Eu vou', () => {
  let service: OrganizadorService;
  let prisma: any;
  const usuarioId = 'usuario-1';
  const organizadorId = 'organizador-1';
  const eventoId = 'evento-1';

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma = {
      cliente: {
        findUnique: jest.fn().mockResolvedValue({
          organizador: { id: organizadorId, status: StatusOrganizador.APROVADO },
        }),
      },
      evento: {
        findUnique: jest.fn().mockResolvedValue({
          id: eventoId,
          organizadorId,
          molduraEuVouUrl: '/uploads/eventos/moldura-antiga.png',
        }),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: eventoId, ...data })),
      },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        OrganizadorService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditLogService, useValue: { log: jest.fn() } },
        { provide: MercadoPagoOAuthService, useValue: {} },
        { provide: EmailService, useValue: {} },
      ],
    }).compile();
    service = moduleRef.get(OrganizadorService);
  });

  it('salva a moldura válida e apaga a anterior', async () => {
    const res = await service.salvarMolduraEuVou(usuarioId, eventoId, png(1080, 1350, 6));

    expect(res.molduraEuVouUrl).toMatch(/^\/uploads\/eventos\/moldura-[0-9a-f-]{36}\.png$/);
    expect(writeFile).toHaveBeenCalledTimes(1);
    expect(unlink).toHaveBeenCalledWith(expect.stringContaining('moldura-antiga.png'));
  });

  it('moldura inválida: nada é gravado nem apagado', async () => {
    await expect(
      service.salvarMolduraEuVou(usuarioId, eventoId, png(1080, 1350, 2)),
    ).rejects.toThrow(BadRequestException);
    expect(writeFile).not.toHaveBeenCalled();
    expect(prisma.evento.update).not.toHaveBeenCalled();
    expect(unlink).not.toHaveBeenCalled();
  });

  it('evento de outro organizador: recusa antes de gravar', async () => {
    prisma.evento.findUnique.mockResolvedValue({ id: eventoId, organizadorId: 'outro' });

    await expect(
      service.salvarMolduraEuVou(usuarioId, eventoId, png(1080, 1350, 6)),
    ).rejects.toThrow(NotFoundException);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('remover limpa o campo e apaga o arquivo', async () => {
    const res = await service.removerMolduraEuVou(usuarioId, eventoId);

    expect(res.molduraEuVouUrl).toBeNull();
    expect(unlink).toHaveBeenCalledWith(expect.stringContaining('moldura-antiga.png'));
  });
});
