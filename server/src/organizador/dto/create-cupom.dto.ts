import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreateCupomDto {
  @IsString()
  @MinLength(2)
  codigo: string;

  @IsNumber()
  @Min(0.01)
  @Max(100)
  percentualDesconto: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantidadeMaxima?: number;

  @IsOptional()
  @IsDateString()
  validoAte?: string;
}
