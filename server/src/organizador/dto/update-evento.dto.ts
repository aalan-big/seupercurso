import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { StatusEvento } from '../../generated/prisma/enums';

export class UpdateEventoDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  nome?: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsString()
  regulamentoUrl?: string;

  @IsOptional()
  @IsString()
  mapaEmbedUrl?: string;

  @IsOptional()
  @IsString()
  rotaGeoJson?: string;

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

  @IsOptional()
  @IsBoolean()
  aplicaDescontoIdoso?: boolean;

  @IsOptional()
  @IsBoolean()
  taxaRepassadaAtleta?: boolean;

  @IsOptional()
  @IsBoolean()
  aceitaPix?: boolean;

  @IsOptional()
  @IsBoolean()
  aceitaCartao?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(100)
  percentualDescontoIdoso?: number;

  @IsOptional()
  @IsDateString()
  dataInicio?: string;

  @IsOptional()
  @IsDateString()
  dataFim?: string;

  @IsOptional()
  @IsString()
  local?: string;

  @IsOptional()
  @IsString()
  cidade?: string;

  @IsOptional()
  @IsString()
  estado?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacidade?: number;

  @IsOptional()
  @IsEnum(StatusEvento)
  status?: StatusEvento;
}
