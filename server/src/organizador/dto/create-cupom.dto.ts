import {
  IsDateString,
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

  // Sem quantidadeMaxima: os usos de cada cupom vem de Evento.usosPorCupom,
  // que so o admin muda. Se o painel antigo mandar o campo, o whitelist descarta.

  @IsOptional()
  @IsDateString()
  validoAte?: string;
}
