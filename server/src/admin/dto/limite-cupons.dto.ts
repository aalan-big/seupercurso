import { IsInt, Max, Min } from 'class-validator';

export class LimiteCuponsDto {
  // 0 bloqueia cupom novo no evento; os ja criados continuam valendo.
  @IsInt()
  @Min(0)
  @Max(1000)
  limiteCupons: number;
}
