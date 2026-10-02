import { IsOptional, IsString, MaxLength } from 'class-validator';

export class MotivoCotacaoDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  motivo?: string;
}
