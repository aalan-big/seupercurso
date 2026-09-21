import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { Prisma } from '../generated/prisma/client';
import { RegisterDto } from './dto/register.dto';
import { RegisterCompletoDto } from './dto/register-completo.dto';
import { LoginDto } from './dto/login.dto';
import { ChangeSenhaDto } from './dto/change-senha.dto';
import { ChangeEmailDto } from './dto/change-email.dto';

const SALT_ROUNDS = 12;

const PUBLIC_USUARIO_SELECT = {
  id: true,
  email: true,
  status: true,
  emailVerificado: true,
  ultimoLogin: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {}

  async register(dto: RegisterDto) {
    const existente = await this.prisma.usuario.findUnique({
      where: { email: dto.email },
    });
    if (existente) {
      throw new ConflictException('Já existe uma conta com esse e-mail.');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const emailToken = crypto.randomBytes(32).toString('hex');
    const emailTokenExpiraEm = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    const usuario = await this.prisma.usuario.create({
      data: {
        email: dto.email,
        passwordHash,
        emailVerificado: true,
        emailToken,
        emailTokenExpiraEm,
      },
      select: PUBLIC_USUARIO_SELECT,
    });

    // Envia e-mail de verificação em segundo plano
    this.emailService.enviarEmailVerificacao({
      email: dto.email,
      nome: dto.email.split('@')[0],
      token: emailToken,
    }).catch(() => null);

    const accessToken = await this.signToken(usuario.id, usuario.email);
    return { accessToken, usuario };
  }

  async emailDisponivel(email: string) {
    const existente = await this.prisma.usuario.findUnique({
      where: { email },
      select: { id: true },
    });
    return { disponivel: !existente };
  }

  async registrarCompleto(dto: RegisterCompletoDto) {
    dto.pessoaFisica.cpf = dto.pessoaFisica.cpf.replace(/\D/g, '');

    const existente = await this.prisma.usuario.findUnique({
      where: { email: dto.email },
    });
    if (existente) {
      throw new ConflictException('Já existe uma conta com esse e-mail.');
    }

    const cpfExistente = await this.prisma.clientePf.findUnique({
      where: { cpf: dto.pessoaFisica.cpf },
    });
    if (cpfExistente) {
      throw new ConflictException('Já existe um cadastro com esse CPF.');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const emailToken = crypto.randomBytes(32).toString('hex');
    const emailTokenExpiraEm = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    let usuario;
    try {
      usuario = await this.prisma.usuario.create({
        data: {
          email: dto.email,
          passwordHash,
          emailVerificado: true,
          emailToken,
          emailTokenExpiraEm,
          cliente: {
            create: {
              pf: {
                create: {
                  ...dto.pessoaFisica,
                  dataNascimento: new Date(dto.pessoaFisica.dataNascimento),
                },
              },
              enderecos: { create: dto.endereco },
            },
          },
        },
        select: PUBLIC_USUARIO_SELECT,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Já existe uma conta com esses dados.',
        );
      }
      throw error;
    }

    this.emailService.enviarEmailVerificacao({
      email: dto.email,
      nome: dto.pessoaFisica.nomeCompleto,
      token: emailToken,
    }).catch(() => null);

    const accessToken = await this.signToken(usuario.id, usuario.email);
    return { accessToken, usuario };
  }

  async reenviarVerificacao(usuarioId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      include: { cliente: { include: { pf: true } } },
    });

    if (!usuario) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    if (usuario.emailVerificado) {
      return { sucesso: true, mensagem: 'Seu e-mail já está verificado.' };
    }

    const emailToken = crypto.randomBytes(32).toString('hex');
    const emailTokenExpiraEm = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { emailToken, emailTokenExpiraEm },
    });

    const nome = usuario.cliente?.pf?.nomeCompleto || usuario.email.split('@')[0];

    await this.emailService.enviarEmailVerificacao({
      email: usuario.email,
      nome,
      token: emailToken,
    });

    return { sucesso: true, mensagem: 'E-mail de verificação reenviado com sucesso!' };
  }

  async verificarEmail(token: string) {
    const usuario = await this.prisma.usuario.findFirst({
      where: {
        emailToken: token,
        emailTokenExpiraEm: { gte: new Date() },
      },
    });

    if (!usuario) {
      throw new BadRequestException('Token de verificação inválido ou expirado.');
    }

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        emailVerificado: true,
        emailToken: null,
        emailTokenExpiraEm: null,
      },
    });

    return { sucesso: true, mensagem: 'E-mail verificado com sucesso!' };
  }

  async solicitarRecuperacaoSenha(email: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email },
      include: { cliente: { include: { pf: true } } },
    });

    if (!usuario) {
      // Retorna sucesso para evitar enumeração de usuários
      return { sucesso: true, mensagem: 'Se o e-mail estiver cadastrado, você receberá um link de recuperação.' };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiraEm = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        resetToken,
        resetTokenExpiraEm,
      },
    });

    const nome = usuario.cliente?.pf?.nomeCompleto || usuario.email.split('@')[0];

    await this.emailService.enviarEmailRecuperacaoSenha({
      email: usuario.email,
      nome,
      token: resetToken,
    });

    return { sucesso: true, mensagem: 'E-mail de recuperação enviado com sucesso!' };
  }

  async redefinirSenha(token: string, novaSenha: string) {
    const usuario = await this.prisma.usuario.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiraEm: { gte: new Date() },
      },
    });

    if (!usuario) {
      throw new BadRequestException('Token de redefinição de senha inválido ou expirado.');
    }

    const passwordHash = await bcrypt.hash(novaSenha, SALT_ROUNDS);

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpiraEm: null,
      },
    });

    return { sucesso: true, mensagem: 'Senha alterada com sucesso! Faça login com sua nova senha.' };
  }

  async login(dto: LoginDto) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email: dto.email },
    });

    const senhaValida = usuario
      ? await bcrypt.compare(dto.password, usuario.passwordHash)
      : false;
    if (!usuario || !senhaValida) {
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }

    const usuarioAtualizado = await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { ultimoLogin: new Date() },
      select: PUBLIC_USUARIO_SELECT,
    });

    const accessToken = await this.signToken(
      usuarioAtualizado.id,
      usuarioAtualizado.email,
    );
    return { accessToken, usuario: usuarioAtualizado };
  }

  async alterarSenha(usuarioId: string, dto: ChangeSenhaDto) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
    });
    if (!usuario) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const senhaValida = await bcrypt.compare(
      dto.senhaAtual,
      usuario.passwordHash,
    );
    if (!senhaValida) {
      throw new UnauthorizedException('Senha atual incorreta.');
    }

    const passwordHash = await bcrypt.hash(dto.novaSenha, SALT_ROUNDS);

    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { passwordHash },
    });

    return { sucesso: true };
  }

  async alterarEmail(usuarioId: string, dto: ChangeEmailDto) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      include: { cliente: { include: { pf: true } } },
    });
    if (!usuario) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    // Exige a senha atual: trocar o e-mail de acesso é tão sensível quanto
    // trocar a senha, e uma sessão aberta não pode bastar para isso.
    const senhaValida = await bcrypt.compare(
      dto.senhaAtual,
      usuario.passwordHash,
    );
    if (!senhaValida) {
      throw new UnauthorizedException('Senha atual incorreta.');
    }

    if (dto.novoEmail === usuario.email) {
      throw new BadRequestException('O novo e-mail é igual ao atual.');
    }

    const emJogo = await this.prisma.usuario.findUnique({
      where: { email: dto.novoEmail },
      select: { id: true },
    });
    if (emJogo) {
      throw new ConflictException('Já existe uma conta com esse e-mail.');
    }

    const emailToken = crypto.randomBytes(32).toString('hex');
    const emailTokenExpiraEm = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    let usuarioAtualizado;
    try {
      usuarioAtualizado = await this.prisma.usuario.update({
        where: { id: usuario.id },
        data: {
          email: dto.novoEmail,
          emailVerificado: false,
          emailToken,
          emailTokenExpiraEm,
        },
        select: PUBLIC_USUARIO_SELECT,
      });
    } catch (error) {
      // Corrida entre a checagem acima e o update: outro cadastro pegou o e-mail.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Já existe uma conta com esse e-mail.');
      }
      throw error;
    }

    const nome =
      usuario.cliente?.pf?.nomeCompleto || dto.novoEmail.split('@')[0];

    // O e-mail já foi trocado no banco; se o envio falhar o usuário ainda
    // consegue pedir o reenvio pelo aviso da plataforma.
    let emailEnviado = true;
    try {
      await this.emailService.enviarEmailVerificacao({
        email: dto.novoEmail,
        nome,
        token: emailToken,
      });
    } catch {
      emailEnviado = false;
    }

    // O JWT carrega o e-mail no payload; emite um novo para a sessão ficar coerente.
    const accessToken = await this.signToken(
      usuarioAtualizado.id,
      usuarioAtualizado.email,
    );

    return {
      sucesso: true,
      mensagem: emailEnviado
        ? 'E-mail alterado! Enviamos um link de confirmação para o novo endereço.'
        : 'E-mail alterado, mas não conseguimos enviar a confirmação agora. Use o botão "Reenviar e-mail" para tentar de novo.',
      accessToken,
      usuario: usuarioAtualizado,
    };
  }

  async getPerfil(usuarioId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: PUBLIC_USUARIO_SELECT,
    });

    if (!usuario) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    return usuario;
  }

  private signToken(sub: string, email: string) {
    return this.jwtService.signAsync({ sub, email });
  }
}
