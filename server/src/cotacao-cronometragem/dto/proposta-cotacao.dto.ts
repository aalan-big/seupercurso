import { IsNumber, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

const DATA = /^\d{4}-\d{2}-\d{2}$/;

export class PropostaCotacaoDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(1000000)
  valor: number;

  // O que esta incluso: o organizador le isso antes de aceitar.
  @IsString()
  @MinLength(3)
  @MaxLength(4000)
  descricao: string;

  // Datas no formato AAAA-MM-DD; valem ate o fim do dia, horario de Brasilia.
  @Matches(DATA, { message: 'Validade da proposta inválida.' })
  propostaValidaAte: string;

  @Matches(DATA, { message: 'Prazo de pagamento inválido.' })
  pagamentoAte: string;
}
