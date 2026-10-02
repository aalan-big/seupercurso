import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DadosPagamentoCronometragemDto {
  // Chave PIX, favorecido, banco... Vazio apaga.
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  dados?: string;
}
