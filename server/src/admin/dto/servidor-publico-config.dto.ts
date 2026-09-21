import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class ServidorPublicoConfigDto {
  @IsBoolean()
  liberado: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  vagas?: number | null;
}
