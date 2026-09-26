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

  // Ate 90%: acima disso o valor pago pode nao cobrir a comissao da
  // plataforma, que sai sobre o preco cheio.
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
