import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateDadosBancariosDto {
  @IsOptional()
  @IsString()
  chavePix?: string;

  @IsOptional()
  @IsString()
  banco?: string;

  @IsOptional()
  @IsString()
  agencia?: string;

  @IsOptional()
  @IsString()
  conta?: string;

  @IsOptional()
  @IsIn(['CORRENTE', 'POUPANCA'])
  tipoConta?: string;

  /** Renda mensal (PF) ou faturamento mensal (PJ) — exigido pelo Asaas. */
  @IsOptional()
  @IsNumber()
  @Min(1, { message: 'Informe a renda ou o faturamento mensal.' })
  rendaFaturamentoMensal?: number;
}
