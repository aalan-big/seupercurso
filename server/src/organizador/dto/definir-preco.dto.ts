import { IsNumber } from 'class-validator';
import { IsValorCobravel } from '../../common/validators/is-valor-cobravel.validator';

export class DefinirPrecoDto {
  @IsNumber()
  @IsValorCobravel()
  valor: number;
}
