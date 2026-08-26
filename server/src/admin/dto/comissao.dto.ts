import { IsNumber, Max, Min } from 'class-validator';

export class ComissaoDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  comissaoPercentual: number;
}
