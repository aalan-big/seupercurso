import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { StaffJwtPayload } from '../types/staff-jwt-payload.interface';

@Injectable()
export class StaffJwtStrategy extends PassportStrategy(Strategy, 'staff-jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET')!,
    });
  }

  async validate(payload: StaffJwtPayload) {
    if (payload.tipo !== 'staff') {
      throw new UnauthorizedException();
    }

    const staff = await this.prisma.staff.findUnique({
      where: { id: payload.sub },
    });
    if (!staff || !staff.ativo) {
      throw new UnauthorizedException();
    }

    return {
      staffId: staff.id,
      organizadorId: staff.organizadorId,
      email: staff.email,
    };
  }
}
