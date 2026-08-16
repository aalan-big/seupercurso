import { IsDateString, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class UpdateLoteDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  nome?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantidade?: number;

  @IsOptional()
  @IsDateString()
  inicioVenda?: string;

  @IsOptional()
  @IsDateString()
  fimVenda?: string;
}
