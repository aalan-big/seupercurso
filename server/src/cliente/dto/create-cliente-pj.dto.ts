import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { IsCNPJ } from '../../common/validators/is-cnpj.validator';

export class CreateClientePjDto {
  @IsString()
  @IsNotEmpty()
  razaoSocial: string;

  @IsOptional()
  @IsString()
  nomeFantasia?: string;

  @IsString()
  @IsCNPJ()
  cnpj: string;

  @IsString()
  @IsNotEmpty()
  nomeResponsavel: string;

  @IsString()
  @IsNotEmpty()
  documentoResponsavel: string;

  @IsString()
  @Matches(/^\(?\d{2}\)?[\s-]?\d{4,5}-?\d{4}$/, {
    message: 'Celular inválido.',
  })
  celularComercial: string;
}
