import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { MetodoPagamento } from '../../generated/prisma/enums';

/** Campos exigidos apenas quando a cobrança é no cartão de crédito. */
const ehCartao = (dto: CreatePagamentoDto) =>
  dto.metodo === MetodoPagamento.CARTAO_CREDITO;

/**
 * Dados de cartão não passam mais por aqui.
 *
 * O navegador tokeniza o cartão direto no Mercado Pago e nos envia apenas o
 * token — número, validade e CVV nunca tocam o nosso servidor, o que tira a
 * aplicação do escopo mais pesado de PCI.
 */
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
  @IsString({ message: 'Não foi possível validar o cartão. Tente novamente.' })
  tokenCartao?: string;

  /** Bandeira detectada pelo Mercado Pago (visa, master, elo...). */
  @IsOptional()
  @IsString()
  metodoBandeira?: string;

  /** Banco emissor identificado pelo Mercado Pago. */
  @IsOptional()
  @IsString()
  emissor?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  parcelas?: number;
}
