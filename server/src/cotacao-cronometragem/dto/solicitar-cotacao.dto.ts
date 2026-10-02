import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CHAVES_SERVICOS } from '../servicos';

export class SolicitarCotacaoDto {
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(CHAVES_SERVICOS.length)
  @IsIn(CHAVES_SERVICOS, { each: true })
  servicos: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  atletasEstimados?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  pontosPassagem?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacoes?: string;
}
