import { NotFoundException } from '@nestjs/common';
import { EventoService } from './evento.service';

describe('EventoService.arquivoMolduraEuVou', () => {
  const id = '3f2b8c1e-1a2b-4c3d-8e9f-0a1b2c3d4e5f';
  const servico = (molduraEuVouUrl: string | null, existe = true) => {
    const prisma: any = {
      evento: { findUnique: jest.fn().mockResolvedValue(existe ? { molduraEuVouUrl } : null) },
    };
    return { svc: new EventoService(prisma), prisma };
  };

  it('devolve o caminho da moldura dentro de uploads/eventos', async () => {
    const { svc } = servico('/uploads/eventos/moldura-abc.png');
    const caminho = (await svc.arquivoMolduraEuVou(id)).split('\\').join('/');
    expect(caminho.endsWith('/uploads/eventos/moldura-abc.png')).toBe(true);
  });

  it('id que não é UUID: 404 sem consultar o banco', async () => {
    const { svc, prisma } = servico('/uploads/eventos/x.png');
    await expect(svc.arquivoMolduraEuVou('../../etc')).rejects.toThrow(NotFoundException);
    expect(prisma.evento.findUnique).not.toHaveBeenCalled();
  });

  it('sem moldura, evento inexistente ou caminho fora da pasta: 404', async () => {
    for (const [url, existe] of [[null, true], ['/uploads/eventos/x.png', false], ['/uploads/documentos/rg.png', true], ['/uploads/eventos/../documentos/rg.png', true]] as const) {
      const { svc } = servico(url, existe);
      await expect(svc.arquivoMolduraEuVou(id)).rejects.toThrow(NotFoundException);
    }
  });
});
