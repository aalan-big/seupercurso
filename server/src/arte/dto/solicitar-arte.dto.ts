import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SolicitarArteDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacoes?: string;
}
