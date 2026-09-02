import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { MetodoPagamento } from '../../generated/prisma/enums';

/** O front envia CPF/CEP mascarados; normaliza para dígitos antes de validar. */
const SomenteDigitos = () =>
  Transform(({ value }) =>
    typeof value === 'string' ? value.replace(/\D/g, '') : value,
  );

/** Campos exigidos apenas quando a cobrança é no cartão de crédito. */
const ehCartao = (dto: CreatePagamentoDto) =>
  dto.metodo === MetodoPagamento.CARTAO_CREDITO;

export class CreatePagamentoDto {
  @IsOptional()
  @IsUUID()
  inscricaoId?: string;

  @IsOptional()
  @IsUUID()
  pedidoId?: string;

  @IsEnum(MetodoPagamento)
  metodo: MetodoPagamento;

  @ValidateIf(ehCartao)
  @IsString()
  @Length(2, 100, { message: 'Informe o nome impresso no cartão.' })
  cartaoHolderName?: string;

  @ValidateIf(ehCartao)
  @IsString()
  @Matches(/^[\d\s]{13,25}$/, { message: 'Número de cartão inválido.' })
  cartaoNumero?: string;

  @ValidateIf(ehCartao)
  @IsString()
  @Matches(/^(0?[1-9]|1[0-2])$/, { message: 'Mês de validade inválido.' })
  cartaoMesValidade?: string;

  @ValidateIf(ehCartao)
  @IsString()
  @Matches(/^\d{4}$/, { message: 'Ano de validade inválido (use 4 dígitos).' })
  cartaoAnoValidade?: string;

  @ValidateIf(ehCartao)
  @IsString()
  @Matches(/^\d{3,4}$/, { message: 'Código de segurança (CVV) inválido.' })
  cartaoCcv?: string;

  @ValidateIf(ehCartao)
  @SomenteDigitos()
  @IsString()
  @Matches(/^\d{11}$|^\d{14}$/, {
    message: 'CPF/CNPJ do titular do cartão inválido.',
  })
  cpfTitular?: string;

  @ValidateIf(ehCartao)
  @SomenteDigitos()
  @IsString()
  @Matches(/^\d{8}$/, { message: 'CEP do titular inválido.' })
  cep?: string;

  @ValidateIf(ehCartao)
  @IsString()
  @Length(1, 10, { message: 'Informe o número do endereço do titular.' })
  numeroResidencia?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  parcelas?: number;
}
