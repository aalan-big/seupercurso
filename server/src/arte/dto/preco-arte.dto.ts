import { IsNumber, Min } from 'class-validator';

export class PrecoArteDto {
  @IsNumber()
  @Min(0)
  valor: number;
}
