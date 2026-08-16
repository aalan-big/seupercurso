import { IsNumber, Min } from 'class-validator';

export class DefinirPrecoDto {
  @IsNumber()
  @Min(0)
  valor: number;
}
