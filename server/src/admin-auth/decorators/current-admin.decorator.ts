import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedAdmin {
  adminId: string;
  email: string;
}

export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedAdmin => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
