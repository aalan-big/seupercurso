import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class ServidorPublicoConfigDto {
  @IsBoolean()
  liberado: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  vagas?: number | null;

  // Evento 100% gratuito para todos. Fica no mesmo card do servidor publico e
  // nao pode ser ligado junto com ele. `vagas` vale para o modo escolhido.
  @IsOptional()
  @IsBoolean()
  gratuito?: boolean;
}
