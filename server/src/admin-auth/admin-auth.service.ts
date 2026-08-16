import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AdminLoginDto } from './dto/admin-login.dto';

const PUBLIC_ADMIN_SELECT = {
  id: true,
  email: true,
  nome: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: AdminLoginDto) {
    const admin = await this.prisma.admin.findUnique({
      where: { email: dto.email },
    });

    const senhaValida = admin
      ? await bcrypt.compare(dto.password, admin.passwordHash)
      : false;
    if (!admin || !senhaValida) {
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }

    const accessToken = await this.jwtService.signAsync({
      sub: admin.id,
      email: admin.email,
      tipo: 'admin',
    });

    return {
      accessToken,
      admin: {
        id: admin.id,
        email: admin.email,
        nome: admin.nome,
        createdAt: admin.createdAt,
        updatedAt: admin.updatedAt,
      },
    };
  }

  async getPerfil(adminId: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
      select: PUBLIC_ADMIN_SELECT,
    });
    if (!admin) {
      throw new UnauthorizedException();
    }
    return admin;
  }
}
