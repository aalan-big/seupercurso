import { IsBoolean } from 'class-validator';

export class CortesiaCupomDto {
  // true: o cupom nao cobra a taxa do site (cortesia liberada pelo admin).
  @IsBoolean()
  cortesiaSemTaxa: boolean;
}
