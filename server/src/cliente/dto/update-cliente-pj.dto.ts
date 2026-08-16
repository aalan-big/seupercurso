import { IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { IsCNPJ } from '../../common/validators/is-cnpj.validator';

export class UpdateClientePjDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  razaoSocial?: string;

  @IsOptional()
  @IsString()
  nomeFantasia?: string;

  @IsOptional()
  @IsString()
  @IsCNPJ()
  cnpj?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  nomeResponsavel?: string;

  @IsOptional()
  @IsString()
  documentoResponsavel?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\(?\d{2}\)?[\s-]?\d{4,5}-?\d{4}$/, {
    message: 'Celular inválido.',
  })
  celularComercial?: string;
}
