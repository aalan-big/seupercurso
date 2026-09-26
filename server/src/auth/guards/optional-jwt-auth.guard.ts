import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Identifica o usuario quando o token vem, mas nunca barra a rota: sem token
 * (ou com token vencido) segue como visitante e `request.user` fica null.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = any>(_err: unknown, user: TUser): TUser {
    return (user || null) as TUser;
  }
}
