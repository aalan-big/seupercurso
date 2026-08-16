import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateModalidadeDto {
  @IsString()
  @MinLength(2)
  nome: string;

  @IsNumber()
  @Min(0.1)
  distanciaKm: number;

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
}
