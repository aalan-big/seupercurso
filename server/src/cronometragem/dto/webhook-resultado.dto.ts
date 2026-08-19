import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class WebhookResultadoDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe o número de peito.' })
  numeroPeito: string;

  @IsNumber({}, { message: 'Informe o tempo líquido em segundos.' })
  tempoLiquidoSegundos: number;

  @IsNumber({}, { message: 'Informe o tempo bruto em segundos.' })
  @IsOptional()
  tempoBrutoSegundos?: number;

  @IsString()
  @IsOptional()
  status?: string; // FINALIZADO, DNF, DNS, DESCLASSIFICADO
}
