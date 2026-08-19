import { IsArray, IsNotEmpty } from 'class-validator';
import { WebhookResultadoDto } from './webhook-resultado.dto';

export class ImportarCsvResultadoDto {
  @IsArray({ message: 'Envie a lista de resultados dos atletas.' })
  @IsNotEmpty({ message: 'A lista de resultados não pode estar vazia.' })
  resultados: WebhookResultadoDto[];
}
