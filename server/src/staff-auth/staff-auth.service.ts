import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { StaffLoginDto } from './dto/staff-login.dto';

@Injectable()
export class StaffAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: StaffLoginDto) {
    const staff = await this.prisma.staff.findUnique({
      where: { email: dto.email },
    });

    const senhaValida = staff
      ? await bcrypt.compare(dto.password, staff.passwordHash)
      : false;
    if (!staff || !senhaValida) {
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }
    if (!staff.ativo) {
      throw new UnauthorizedException('Este acesso está desativado.');
    }

    const accessToken = await this.jwtService.signAsync({
      sub: staff.id,
      email: staff.email,
      organizadorId: staff.organizadorId,
      tipo: 'staff',
    });

    return {
      accessToken,
      staff: {
        id: staff.id,
        nome: staff.nome,
        email: staff.email,
        funcao: staff.funcao,
      },
    };
  }
}
