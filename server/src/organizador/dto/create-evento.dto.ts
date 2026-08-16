import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateEventoDto {
  @IsString()
  @MinLength(3)
  nome: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsString()
  regulamentoUrl?: string;

  @IsOptional()
  @IsString()
  termoResponsabilidade?: string;

  @IsOptional()
  @IsString()
  retiradaKitLocal?: string;

  @IsOptional()
  @IsDateString()
  retiradaKitInicio?: string;

  @IsOptional()
  @IsDateString()
  retiradaKitFim?: string;

  @IsDateString()
  dataInicio: string;

  @IsDateString()
  dataFim: string;

  @IsString()
  local: string;

  @IsString()
  cidade: string;

  @IsString()
  estado: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacidade?: number;
}
