import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

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
  ) {}

  async register(dto: RegisterDto) {
    const existente = await this.prisma.usuario.findUnique({
      where: { email: dto.email },
    });
    if (existente) {
      throw new ConflictException('Já existe uma conta com esse e-mail.');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const usuario = await this.prisma.usuario.create({
      data: { email: dto.email, passwordHash },
      select: PUBLIC_USUARIO_SELECT,
    });

    const accessToken = await this.signToken(usuario.id, usuario.email);
    return { accessToken, usuario };
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
