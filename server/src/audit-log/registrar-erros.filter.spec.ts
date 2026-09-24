import {
  BadRequestException,
  Controller,
  Get,
  INestApplication,
  NotFoundException,
} from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { RegistrarErrosFilter } from './registrar-erros.filter';
import { AuditLogService } from './audit-log.service';

@Controller('teste')
class ControllerDeTeste {
  @Get('quebra')
  quebra() {
    throw new Error('falha inesperada');
  }

  @Get('validacao')
  validacao() {
    throw new BadRequestException('Campo obrigatório.');
  }

  @Get('nao-existe')
  naoExiste() {
    throw new NotFoundException('Evento não encontrado.');
  }
}

async function montarApp(comFiltro: boolean, auditLog: { log: jest.Mock }) {
  const moduleRef = await Test.createTestingModule({
    controllers: [ControllerDeTeste],
    providers: [
      { provide: AuditLogService, useValue: auditLog },
      ...(comFiltro ? [{ provide: APP_FILTER, useClass: RegistrarErrosFilter }] : []),
    ],
  }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  await app.init();
  return app;
}

describe('RegistrarErrosFilter', () => {
  let semFiltro: INestApplication;
  let comFiltro: INestApplication;
  let auditLog: { log: jest.Mock };

  beforeEach(async () => {
    auditLog = { log: jest.fn() };
    semFiltro = await montarApp(false, { log: jest.fn() });
    comFiltro = await montarApp(true, auditLog);
  });

  afterEach(async () => {
    await semFiltro.close();
    await comFiltro.close();
  });

  // O ponto principal: o site e os paineis recebem exatamente o mesmo erro.
  it.each(['/teste/quebra', '/teste/validacao', '/teste/nao-existe'])(
    'responde %s igual a quando o filtro nao existia',
    async (rota) => {
      const antes = await request(semFiltro.getHttpServer()).get(rota);
      const depois = await request(comFiltro.getHttpServer()).get(rota);

      expect(depois.status).toBe(antes.status);
      expect(depois.body).toEqual(antes.body);
    },
  );

  it('registra erro 500 na tela de logs, sem query string', async () => {
    await request(comFiltro.getHttpServer()).get('/teste/quebra?token=segredo');

    expect(auditLog.log).toHaveBeenCalledTimes(1);
    const registro = auditLog.log.mock.calls[0][0];
    expect(registro.nivel).toBe('ERROR');
    expect(registro.mensagem).toContain('GET /teste/quebra');
    expect(registro.mensagem).toContain('falha inesperada');
    expect(JSON.stringify(registro)).not.toContain('segredo');
  });

  it('nao registra erros esperados (4xx)', async () => {
    await request(comFiltro.getHttpServer()).get('/teste/validacao');
    await request(comFiltro.getHttpServer()).get('/teste/nao-existe');

    expect(auditLog.log).not.toHaveBeenCalled();
  });

  it('o mesmo erro repetido entra uma vez por minuto', async () => {
    await request(comFiltro.getHttpServer()).get('/teste/quebra');
    await request(comFiltro.getHttpServer()).get('/teste/quebra');
    await request(comFiltro.getHttpServer()).get('/teste/quebra');

    expect(auditLog.log).toHaveBeenCalledTimes(1);
  });

  it('falha ao registrar nao impede a resposta de erro', async () => {
    auditLog.log.mockImplementation(() => {
      throw new Error('banco fora do ar');
    });

    const res = await request(comFiltro.getHttpServer()).get('/teste/quebra');

    expect(res.status).toBe(500);
  });
});
