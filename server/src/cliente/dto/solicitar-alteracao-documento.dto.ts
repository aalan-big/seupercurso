import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class SolicitarAlteracaoDocumentoDto {
  /** Novo CPF (11 dígitos) ou CNPJ (14). O tipo é inferido do cadastro atual. */
  @Transform(({ value }) =>
    typeof value === 'string' ? value.replace(/\D/g, '') : value,
  )
  @IsString()
  @Matches(/^\d{11}$|^\d{14}$/, {
    message: 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.',
  })
  documentoNovo: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  motivo?: string;
}
