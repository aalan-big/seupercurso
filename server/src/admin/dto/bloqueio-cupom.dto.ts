import { IsBoolean } from 'class-validator';

export class BloqueioCupomDto {
  // true bloqueia o cupom (deixa de valer em inscricao nova); false libera.
  @IsBoolean()
  bloqueado: boolean;
}
