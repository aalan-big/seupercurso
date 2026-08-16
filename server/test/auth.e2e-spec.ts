import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const email = `e2e-${Date.now()}@seupercurso.test`;
  const password = 'senha12345';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    prisma = moduleFixture.get(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    await prisma.usuario.deleteMany({ where: { email } });
    await app.close();
  });

  it('registra um novo usuário e retorna o token', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password })
      .expect(201);

    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.usuario).toMatchObject({ email });
    expect(res.body.usuario.passwordHash).toBeUndefined();
  });

  it('rejeita registro duplicado com o mesmo e-mail', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password })
      .expect(409);
  });

  it('faz login com credenciais corretas', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    expect(res.body.accessToken).toEqual(expect.any(String));
  });

  it('rejeita login com senha errada', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'senhaerrada' })
      .expect(401);
  });

  it('retorna o perfil autenticado em /auth/me', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.email).toBe(email);
      });
  });

  it('rejeita /auth/me sem token', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });
});
