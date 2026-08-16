import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { GeneroCategoria } from '../../generated/prisma/enums';

export class UpdateCategoriaDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  nome?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  idadeMinima?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  idadeMaxima?: number;

  @IsOptional()
  @IsEnum(GeneroCategoria)
  genero?: GeneroCategoria;

  @IsOptional()
  @IsBoolean()
  pcd?: boolean;
}
