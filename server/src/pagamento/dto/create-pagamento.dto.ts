import { IsEnum, IsUUID } from 'class-validator';
import { MetodoPagamento } from '../../generated/prisma/enums';

export class CreatePagamentoDto {
  @IsUUID()
  inscricaoId: string;

  @IsEnum(MetodoPagamento)
  metodo: MetodoPagamento;
}
