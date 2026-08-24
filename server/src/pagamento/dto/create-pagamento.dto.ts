import { IsEnum, IsOptional, IsString, IsUUID, IsNumber } from 'class-validator';
import { MetodoPagamento } from '../../generated/prisma/enums';

export class CreatePagamentoDto {
  @IsUUID()
  inscricaoId: string;

  @IsEnum(MetodoPagamento)
  metodo: MetodoPagamento;

  @IsOptional()
  @IsString()
  cartaoHolderName?: string;

  @IsOptional()
  @IsString()
  cartaoNumero?: string;

  @IsOptional()
  @IsString()
  cartaoMesValidade?: string;

  @IsOptional()
  @IsString()
  cartaoAnoValidade?: string;

  @IsOptional()
  @IsString()
  cartaoCcv?: string;

  @IsOptional()
  @IsNumber()
  parcelas?: number;

  @IsOptional()
  @IsString()
  cpfTitular?: string;

  @IsOptional()
  @IsString()
  cep?: string;

  @IsOptional()
  @IsString()
  numeroResidencia?: string;
}
