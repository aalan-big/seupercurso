import { IsDateString, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateLoteDto {
  @IsString()
  @MinLength(2)
  nome: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantidade?: number;

  @IsDateString()
  inicioVenda: string;

  @IsDateString()
  fimVenda: string;
}
