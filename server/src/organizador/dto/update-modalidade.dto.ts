import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateModalidadeDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  nome?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  distanciaKm?: number;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  idadeMinima?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  idadeMaxima?: number;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @IsOptional()
  @IsString()
  mapaEmbedUrl?: string;

  @IsOptional()
  @IsString()
  rotaGeoJson?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacidade?: number | null;
}
