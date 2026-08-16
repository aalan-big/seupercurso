import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedStaff {
  staffId: string;
  organizadorId: string;
  email: string;
}

export const CurrentStaff = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedStaff => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
