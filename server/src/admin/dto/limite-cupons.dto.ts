import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class LimiteCuponsDto {
  // 0 bloqueia cupom novo no evento; os ja criados continuam valendo.
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  limiteCupons?: number;

  // Usos de cada cupom criado daqui pra frente; os ja criados nao mudam.
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  usosPorCupom?: number;
}
