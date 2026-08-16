import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { Genero } from '../../generated/prisma/enums';
import { IsCPF } from '../../common/validators/is-cpf.validator';

export class CreateClientePfDto {
  @IsString()
  @MinLength(3)
  nomeCompleto: string;

  @IsString()
  @IsCPF()
  cpf: string;

  @IsDateString()
  dataNascimento: string;

  @IsEnum(Genero)
  genero: Genero;

  @IsOptional()
  @IsBoolean()
  pcd?: boolean;

  @IsString()
  @Matches(/^\(?\d{2}\)?[\s-]?\d{4,5}-?\d{4}$/, {
    message: 'Celular inválido.',
  })
  celular: string;

  @IsOptional()
  @IsString()
  nacionalidade?: string;
}
