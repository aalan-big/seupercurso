import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    usuario: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let jwtService: { signAsync: jest.Mock };
  let emailService: {
    enviarEmailVerificacao: jest.Mock;
    enviarEmailRecuperacaoSenha: jest.Mock;
  };

  const usuarioPublico = {
    id: 'usuario-1',
    email: 'atleta@example.com',
    status: 'ATIVO',
    emailVerificado: false,
    ultimoLogin: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      usuario: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    jwtService = { signAsync: jest.fn().mockResolvedValue('token-fake') };

    // O cadastro passou a disparar e-mail de verificacao. Sem este dublê o
    // AuthService nem chega a ser construido, e a suite inteira caia antes de
    // verificar qualquer coisa.
    emailService = {
      enviarEmailVerificacao: jest.fn().mockResolvedValue(undefined),
      enviarEmailRecuperacaoSenha: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
    jest.clearAllMocks();
    jwtService.signAsync.mockResolvedValue('token-fake');
    emailService.enviarEmailVerificacao.mockResolvedValue(undefined);
    emailService.enviarEmailRecuperacaoSenha.mockResolvedValue(undefined);
  });

  describe('register', () => {
    it('lança ConflictException se o e-mail já estiver cadastrado', async () => {
      prisma.usuario.findUnique.mockResolvedValue(usuarioPublico);

      await expect(
        service.register({
          email: usuarioPublico.email,
          password: 'senha1234',
        }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.usuario.create).not.toHaveBeenCalled();
    });

    it('cria o usuário com senha hasheada e retorna o token', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hash-fake');
      prisma.usuario.create.mockResolvedValue(usuarioPublico);

      const resultado = await service.register({
        email: usuarioPublico.email,
        password: 'senha1234',
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('senha1234', 12);

      // Comparacao por campo, e nao pelo objeto inteiro: o cadastro passou a
      // gravar tambem o token de verificacao, e uma igualdade exata quebrava a
      // cada campo novo sem que nada de fato tivesse regredido.
      expect(prisma.usuario.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: usuarioPublico.email,
            passwordHash: 'hash-fake',
            emailToken: expect.any(String),
            emailTokenExpiraEm: expect.any(Date),
          }),
        }),
      );

      // Sem o e-mail de verificacao a conta nasce inutilizavel.
      expect(emailService.enviarEmailVerificacao).toHaveBeenCalled();

      expect(resultado).toEqual({
        accessToken: 'token-fake',
        usuario: usuarioPublico,
      });
    });
  });

  describe('login', () => {
    it('lança UnauthorizedException se o usuário não existir', async () => {
      prisma.usuario.findUnique.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'naoexiste@example.com',
          password: 'senha1234',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('lança UnauthorizedException se a senha estiver errada', async () => {
      prisma.usuario.findUnique.mockResolvedValue({
        ...usuarioPublico,
        passwordHash: 'hash-fake',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: usuarioPublico.email, password: 'senhaerrada' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(prisma.usuario.update).not.toHaveBeenCalled();
    });

    it('atualiza ultimoLogin e retorna o token em caso de sucesso', async () => {
      prisma.usuario.findUnique.mockResolvedValue({
        ...usuarioPublico,
        passwordHash: 'hash-fake',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.usuario.update.mockResolvedValue(usuarioPublico);

      const resultado = await service.login({
        email: usuarioPublico.email,
        password: 'senha1234',
      });

      expect(prisma.usuario.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: usuarioPublico.id } }),
      );
      expect(resultado).toEqual({
        accessToken: 'token-fake',
        usuario: usuarioPublico,
      });
    });
  });
});
