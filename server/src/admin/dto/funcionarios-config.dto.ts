import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class FuncionariosConfigDto {
  @IsBoolean()
  liberado: boolean;

  // Ate 90%. A comissao da plataforma sai sobre o valor ja com desconto
  // (ex.: 70 - 15% = 59,50 + 10% = 65,45), igual ao cupom e ao idoso.
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(90)
  percentual?: number;

  // Vazio/null = sem limite.
  @IsOptional()
  @IsInt()
  @Min(1)
  vagas?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  nomeEmpresa?: string | null;
}
