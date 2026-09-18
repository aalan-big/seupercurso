import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
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

  describe('alterarEmail', () => {
    const usuarioComSenha = {
      ...usuarioPublico,
      passwordHash: 'hash-fake',
      cliente: { pf: { nomeCompleto: 'Atleta Teste' } },
    };
    const dto = { senhaAtual: 'senha1234', novoEmail: 'novo@example.com' };

    it('lança UnauthorizedException se a senha atual estiver errada', async () => {
      prisma.usuario.findUnique.mockResolvedValueOnce(usuarioComSenha);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.alterarEmail(usuarioPublico.id, dto)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prisma.usuario.update).not.toHaveBeenCalled();
      expect(emailService.enviarEmailVerificacao).not.toHaveBeenCalled();
    });

    it('lança BadRequestException se o novo e-mail for igual ao atual', async () => {
      prisma.usuario.findUnique.mockResolvedValueOnce(usuarioComSenha);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.alterarEmail(usuarioPublico.id, {
          ...dto,
          novoEmail: usuarioPublico.email,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.usuario.update).not.toHaveBeenCalled();
    });

    it('lança ConflictException se o novo e-mail já pertencer a outra conta', async () => {
      prisma.usuario.findUnique
        .mockResolvedValueOnce(usuarioComSenha)
        .mockResolvedValueOnce({ id: 'outro-usuario' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.alterarEmail(usuarioPublico.id, dto)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.usuario.update).not.toHaveBeenCalled();
    });

    it('troca o e-mail, zera a verificação e envia o link para o novo endereço', async () => {
      prisma.usuario.findUnique
        .mockResolvedValueOnce(usuarioComSenha)
        .mockResolvedValueOnce(null);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      const atualizado = { ...usuarioPublico, email: dto.novoEmail };
      prisma.usuario.update.mockResolvedValue(atualizado);

      const resultado = await service.alterarEmail(usuarioPublico.id, dto);

      expect(prisma.usuario.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: usuarioPublico.id },
          data: expect.objectContaining({
            email: dto.novoEmail,
            emailVerificado: false,
            emailToken: expect.any(String),
            emailTokenExpiraEm: expect.any(Date),
          }),
        }),
      );
      const tokenGerado = prisma.usuario.update.mock.calls[0][0].data.emailToken;
      expect(emailService.enviarEmailVerificacao).toHaveBeenCalledWith({
        email: dto.novoEmail,
        nome: 'Atleta Teste',
        token: tokenGerado,
      });
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: usuarioPublico.id,
        email: dto.novoEmail,
      });
      expect(resultado).toEqual({
        sucesso: true,
        mensagem: expect.stringContaining('Enviamos um link'),
        accessToken: 'token-fake',
        usuario: atualizado,
      });
    });

    it('mantém a troca e avisa quando o envio do e-mail falha', async () => {
      prisma.usuario.findUnique
        .mockResolvedValueOnce(usuarioComSenha)
        .mockResolvedValueOnce(null);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.usuario.update.mockResolvedValue({ ...usuarioPublico, email: dto.novoEmail });
      emailService.enviarEmailVerificacao.mockRejectedValue(new Error('smtp fora'));

      const resultado = await service.alterarEmail(usuarioPublico.id, dto);

      expect(resultado.sucesso).toBe(true);
      expect(resultado.mensagem).toContain('Reenviar e-mail');
      expect(resultado.accessToken).toBe('token-fake');
    });
  });
});
